/**
 * Hourly activity patterns chart (client-side SVG), ported from the shared
 * logic in birdworks species-detail.js and charts.js: individual daily lines
 * overlaid with top-10%/bottom-10% group averages and a rolling average.
 */

export interface DayHourAggregate {
  /** Sorted day keys (YYYY-MM-DD, Mountain Time) */
  days: string[];
  /** dayKey → 24 hourly counts */
  hourlyByDay: Record<string, number[]>;
}

/** Bucket detections into per-day 24-hour counts using Mountain Time */
export function aggregateByDayAndHour(
  detections: Array<{ detected_at: string }>,
): DayHourAggregate {
  const hourlyByDay: Record<string, number[]> = {};
  const days: string[] = [];

  detections.forEach((detection) => {
    try {
      const date = new Date(detection.detected_at);
      const mtDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Denver" }));
      const hour = mtDate.getHours();
      const dayKey = mtDate.toISOString().split("T")[0]!;

      if (!hourlyByDay[dayKey]) {
        hourlyByDay[dayKey] = new Array(24).fill(0);
        days.push(dayKey);
      }
      hourlyByDay[dayKey]![hour]++;
    } catch (e) {
      console.error("Error parsing date:", detection.detected_at, e);
    }
  });

  days.sort();
  return { days, hourlyByDay };
}

export function buildActivityPatternsSVG(
  { days, hourlyByDay }: DayHourAggregate,
  options: { ariaLabel?: string } = {},
): SVGSVGElement {
  // Identify top/bottom 10% days by total activity
  const dayTotals: Record<string, number> = {};
  days.forEach((dayKey) => {
    dayTotals[dayKey] = hourlyByDay[dayKey]!.reduce((a, b) => a + b, 0);
  });

  const sortedByActivity = [...days].sort((a, b) => dayTotals[b]! - dayTotals[a]!);
  const topTenPercent = Math.max(1, Math.ceil(days.length * 0.1));
  const topDays = sortedByActivity.slice(0, topTenPercent);
  const bottomDays = sortedByActivity.slice(-topTenPercent);

  const hourlyMean = (dayKeys: string[], hour: number): number => {
    const values = dayKeys.map((dayKey) => hourlyByDay[dayKey]![hour]!);
    return values.reduce((a, b) => a + b, 0) / values.length || 0;
  };

  const rollingAverage = Array.from({ length: 24 }, (_, h) => hourlyMean(days, h));
  const topAverage = Array.from({ length: 24 }, (_, h) => hourlyMean(topDays, h));
  const bottomAverage = Array.from({ length: 24 }, (_, h) => hourlyMean(bottomDays, h));

  // Chart geometry
  const width = 1200;
  const height = 450;
  const padding = { top: 30, right: 60, bottom: 80, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(
    ...days.map((d) => Math.max(...hourlyByDay[d]!)),
    ...rollingAverage,
    ...topAverage,
    ...bottomAverage,
  );
  const yScale = maxValue > 0 ? chartHeight / maxValue : 1;
  const xStep = chartWidth / 23;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "w-full h-auto");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", options.ariaLabel ?? "Hourly activity patterns chart");

  svg.appendChild(svgLine(padding.left, padding.top, padding.left, height - padding.bottom, "#e5e7eb"));
  svg.appendChild(svgLine(padding.left, height - padding.bottom, width - padding.right, height - padding.bottom, "#e5e7eb"));

  const drawSeries = (dataPoints: number[], color: string, strokeWidth: string, opacity: string) => {
    let pathData = `M ${padding.left} ${height - padding.bottom - dataPoints[0]! * yScale}`;
    for (let hour = 1; hour < 24; hour++) {
      const x = padding.left + hour * xStep;
      const y = height - padding.bottom - dataPoints[hour]! * yScale;
      pathData += ` L ${x} ${y}`;
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", strokeWidth);
    path.setAttribute("fill", "none");
    path.setAttribute("opacity", opacity);
    svg.appendChild(path);
  };

  // Individual daily lines (thin, gray)
  days.forEach((dayKey) => drawSeries(hourlyByDay[dayKey]!, "#9ca3af", "1.5", "0.5"));

  // Group averages: top 10% (orange), bottom 10% (teal), rolling (green, bold)
  drawSeries(topAverage, "#f59e0b", "2", "0.85");
  drawSeries(bottomAverage, "#0891b2", "2", "0.85");
  drawSeries(rollingAverage, "#4A7C2C", "3.5", "1");

  // Data points on rolling average
  for (let hour = 0; hour < 24; hour++) {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", String(padding.left + hour * xStep));
    dot.setAttribute("cy", String(height - padding.bottom - rollingAverage[hour]! * yScale));
    dot.setAttribute("r", "3");
    dot.setAttribute("fill", "#4A7C2C");
    svg.appendChild(dot);
  }

  // X-axis labels (every 3 hours)
  for (let i = 0; i < 24; i += 3) {
    svg.appendChild(
      svgText(padding.left + i * xStep, height - padding.bottom + 20, formatChartHour(i), "11px", "#6b7280", "middle"),
    );
  }

  // Y-axis labels
  const yMid = maxValue / 2;
  const yMidLabel = svgText(padding.left - 10, height - padding.bottom - yMid * yScale, String(Math.round(yMid)), "11px", "#6b7280", "end");
  yMidLabel.setAttribute("dominant-baseline", "middle");
  svg.appendChild(yMidLabel);

  const yMaxLabel = svgText(padding.left - 10, padding.top, String(Math.round(maxValue)), "11px", "#6b7280", "end");
  yMaxLabel.setAttribute("dominant-baseline", "middle");
  svg.appendChild(yMaxLabel);

  const yAxisTitle = svgText(15, height / 2, "Detections per hour", "12px", "#9ca3af", "middle");
  yAxisTitle.setAttribute("dominant-baseline", "middle");
  yAxisTitle.setAttribute("transform", `rotate(-90 15 ${height / 2})`);
  svg.appendChild(yAxisTitle);

  return svg;
}

export function svgLine(x1: number, y1: number, x2: number, y2: number, stroke: string): SVGLineElement {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", String(x1));
  line.setAttribute("y1", String(y1));
  line.setAttribute("x2", String(x2));
  line.setAttribute("y2", String(y2));
  line.setAttribute("stroke", stroke);
  line.setAttribute("stroke-width", "1");
  return line;
}

export function svgText(
  x: number,
  y: number,
  content: string,
  fontSize: string,
  fill: string,
  anchor: string,
): SVGTextElement {
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", String(x));
  text.setAttribute("y", String(y));
  text.setAttribute("font-size", fontSize);
  text.setAttribute("fill", fill);
  text.setAttribute("text-anchor", anchor);
  text.setAttribute("font-family", "Inter, sans-serif");
  text.textContent = content;
  return text;
}

/** 0 → "12 AM", 13 → "1 PM" */
export function formatChartHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}
