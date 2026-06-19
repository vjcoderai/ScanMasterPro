import React, { useState, useRef } from 'react';
import { View, StyleSheet, Image, PanResponder, GestureResponderEvent } from 'react-native';
import Svg, { Path, Line, Polygon, Text as SvgText } from 'react-native-svg';

/**
 * MARKUP CANVAS
 * --------------
 * A drawing overlay on top of a scanned page image, supporting:
 *  - Pen: freehand strokes
 *  - Highlighter: thick, semi-transparent strokes (for highlighting text)
 *  - Arrow: drag to draw a directional arrow
 *  - Text: tap to place a text label at that point
 *
 * The canvas is wrapped by the parent in a `ViewShot` so the flattened
 * image + markup can be exported as a single PNG/JPEG.
 */

export type MarkupTool = 'pen' | 'highlighter' | 'arrow' | 'text' | 'none';

interface Point { x: number; y: number; }

interface PenStroke {
  type: 'pen' | 'highlighter';
  points: Point[];
  color: string;
}

interface ArrowStroke {
  type: 'arrow';
  start: Point;
  end: Point;
  color: string;
}

interface TextStroke {
  type: 'text';
  position: Point;
  text: string;
  color: string;
}

export type MarkupStroke = PenStroke | ArrowStroke | TextStroke;

interface MarkupCanvasProps {
  imageUri: string;
  width: number;
  height: number;
  tool: MarkupTool;
  color: string;
  strokes: MarkupStroke[];
  onStrokesChange: (strokes: MarkupStroke[]) => void;
  /** Called when the user taps with the 'text' tool active, to prompt for text input */
  onRequestText: (position: Point) => void;
}

export const MarkupCanvas: React.FC<MarkupCanvasProps> = ({
  imageUri, width, height, tool, color, strokes, onStrokesChange, onRequestText,
}) => {
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [arrowStart, setArrowStart] = useState<Point | null>(null);
  const [arrowEnd, setArrowEnd] = useState<Point | null>(null);
  const drawing = useRef(false);

  const getLocalPoint = (evt: GestureResponderEvent): Point => {
    const { locationX, locationY } = evt.nativeEvent;
    return { x: locationX, y: locationY };
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => tool !== 'none',
      onMoveShouldSetPanResponder: () => tool !== 'none',

      onPanResponderGrant: (evt) => {
        const point = getLocalPoint(evt);
        if (tool === 'pen' || tool === 'highlighter') {
          drawing.current = true;
          setCurrentPoints([point]);
        } else if (tool === 'arrow') {
          drawing.current = true;
          setArrowStart(point);
          setArrowEnd(point);
        } else if (tool === 'text') {
          onRequestText(point);
        }
      },

      onPanResponderMove: (evt) => {
        if (!drawing.current) return;
        const point = getLocalPoint(evt);
        if (tool === 'pen' || tool === 'highlighter') {
          setCurrentPoints(prev => [...prev, point]);
        } else if (tool === 'arrow') {
          setArrowEnd(point);
        }
      },

      onPanResponderRelease: () => {
        if (!drawing.current) return;
        drawing.current = false;

        if ((tool === 'pen' || tool === 'highlighter') && currentPoints.length > 1) {
          const newStroke: PenStroke = { type: tool, points: currentPoints, color };
          onStrokesChange([...strokes, newStroke]);
          setCurrentPoints([]);
        } else if (tool === 'arrow' && arrowStart && arrowEnd) {
          const newStroke: ArrowStroke = { type: 'arrow', start: arrowStart, end: arrowEnd, color };
          onStrokesChange([...strokes, newStroke]);
          setArrowStart(null);
          setArrowEnd(null);
        } else {
          setCurrentPoints([]);
          setArrowStart(null);
          setArrowEnd(null);
        }
      },
    })
  ).current;

  const pointsToPath = (points: Point[]): string => {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
    return d;
  };

  const renderArrowHead = (start: Point, end: Point, strokeColor: string, key: string) => {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLength = 14;
    const headAngle = Math.PI / 7;
    const p1x = end.x - headLength * Math.cos(angle - headAngle);
    const p1y = end.y - headLength * Math.sin(angle - headAngle);
    const p2x = end.x - headLength * Math.cos(angle + headAngle);
    const p2y = end.y - headLength * Math.sin(angle + headAngle);
    return (
      <Polygon
        key={key}
        points={`${end.x},${end.y} ${p1x},${p1y} ${p2x},${p2y}`}
        fill={strokeColor}
      />
    );
  };

  return (
    <View
      style={[styles.container, { width, height }]}
      {...panResponder.panHandlers}
    >
      <Image source={{ uri: imageUri }} style={[styles.image, { width, height }]} resizeMode="contain" />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {strokes.map((stroke, i) => {
          if (stroke.type === 'pen') {
            return (
              <Path
                key={i}
                d={pointsToPath(stroke.points)}
                stroke={stroke.color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            );
          }
          if (stroke.type === 'highlighter') {
            return (
              <Path
                key={i}
                d={pointsToPath(stroke.points)}
                stroke={stroke.color}
                strokeWidth={18}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={0.35}
              />
            );
          }
          if (stroke.type === 'arrow') {
            return (
              <React.Fragment key={i}>
                <Line
                  x1={stroke.start.x} y1={stroke.start.y}
                  x2={stroke.end.x} y2={stroke.end.y}
                  stroke={stroke.color} strokeWidth={3}
                />
                {renderArrowHead(stroke.start, stroke.end, stroke.color, `head-${i}`)}
              </React.Fragment>
            );
          }
          if (stroke.type === 'text') {
            return (
              <SvgText
                key={i}
                x={stroke.position.x}
                y={stroke.position.y}
                fill={stroke.color}
                fontSize={20}
                fontWeight="bold"
              >
                {stroke.text}
              </SvgText>
            );
          }
          return null;
        })}

        {/* Live preview of stroke in progress */}
        {currentPoints.length > 1 && (tool === 'pen' || tool === 'highlighter') && (
          <Path
            d={pointsToPath(currentPoints)}
            stroke={color}
            strokeWidth={tool === 'highlighter' ? 18 : 3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={tool === 'highlighter' ? 0.35 : 1}
          />
        )}
        {arrowStart && arrowEnd && tool === 'arrow' && (
          <React.Fragment>
            <Line x1={arrowStart.x} y1={arrowStart.y} x2={arrowEnd.x} y2={arrowEnd.y} stroke={color} strokeWidth={3} />
            {renderArrowHead(arrowStart, arrowEnd, color, 'preview-head')}
          </React.Fragment>
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'relative', backgroundColor: '#000' },
  image: { position: 'absolute', top: 0, left: 0 },
});
