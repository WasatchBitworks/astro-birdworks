/**
 * Chart renderers ported from birdworks charts.js (progressive enhancement:
 * server-rendered lists/tables are replaced with SVG charts on load; the
 * markup remains the no-JS fallback).
 *
 * Not ported (dead code in birdworks — no matching containers remain):
 * renderSpeciesChart, renderHourlyProfile, renderHourlyActivity,
 * renderDayOfWeek. The daily-hourly-patterns chart lives in
 * activity-patterns.ts (shared with species detail pages).
 */
import { formatChartHour, svgLine, svgText } from "./activity-patterns";
import { toMountainTime } from "./datetime";

function svgRect(x: number, y: number, width: number, height: number, fill: string): SVGRectElement {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", String(x));
  rect.setAttribute("y", String(y));
  rect.setAttribute("width", String(width));
  rect.setAttribute("height", String(height));
  rect.setAttribute("fill", fill);
  return rect;
}

/** "2026-06-12" → "06/12" */
function formatDateShort(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}`;
  }
  return dateStr;
}

// --- Fallback-markup data extraction ---------------------------------------

/** Read {date, count} rows from the server-rendered daily list */
export function extractDailyData(container: Element): Array<{ date: string; count: number }> {
  const rows = container.querySelectorAll(".flex.justify-between");
  const data: Array<{ date: string; count: number }> = [];

  rows.forEach((row) => {
    const spans = row.querySelectorAll("span");
    if (spans.length === 2) {
      const date = spans[0]!.textContent!.trim();
      const count = parseInt(spans[1]!.textContent!.trim(), 10);
      if (!isNaN(count)) {
        data.push({ date, count });
      }
    }
  });

  return data;
}

/** Read {label, value} rows from a server-rendered fallback table */
export function extractTableData(container: Element): Array<{ label: string; value: number }> {
  const rows = container.querySelectorAll("tbody tr");
  const data: Array<{ label: string; value: number }> = [];

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length >= 2) {
      const label = cells[0]!.textContent!.trim();
      const value = parseInt(cells[1]!.textContent!.trim(), 10);
      if (!isNaN(value)) {
        data.push({ label, value });
      }
    }
  });

  return data;
}

// --- Homepage charts --------------------------------------------------------

/** Daily detections (vertical bars, last 14 days) */
export function renderDailyChart(container: Element, data: Array<{ date: string; count: number }>): void {
  const width = 600;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 60, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxCount = Math.max(...data.map((d) => d.count));
  const barWidth = chartWidth / data.length;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "w-full h-auto");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Daily detections bar chart");

  svg.appendChild(svgLine(padding.left, padding.top, padding.left, height - padding.bottom, "#e5e7eb"));
  svg.appendChild(svgLine(padding.left, height - padding.bottom, width - padding.right, height - padding.bottom, "#e5e7eb"));

  data.forEach((d, i) => {
    const barHeight = maxCount > 0 ? (d.count / maxCount) * chartHeight : 0;
    const x = padding.left + i * barWidth + barWidth * 0.1;
    const y = height - padding.bottom - barHeight;
    const barWidthActual = barWidth * 0.8;

    const bar = svgRect(x, y, barWidthActual, barHeight, "#4A7C2C");
    bar.setAttribute("rx", "2");
    svg.appendChild(bar);

    if (d.count > 0) {
      svg.appendChild(svgText(x + barWidthActual / 2, y - 5, String(d.count), "12px", "#374151", "middle"));
    }

    const dateText = svgText(
      x + barWidthActual / 2,
      height - padding.bottom + 15,
      formatDateShort(d.date),
      "10px",
      "#6b7280",
      "middle",
    );
    dateText.setAttribute("transform", `rotate(-45 ${x + barWidthActual / 2} ${height - padding.bottom + 15})`);
    svg.appendChild(dateText);
  });

  container.innerHTML = "";
  container.appendChild(svg);
}

/** Average hourly activity (horizontal bars, 14-day average per hour) */
export function renderHourlyAverage(container: Element, detections: Array<{ detected_at: string }>): void {
  // Filter to last 14 days
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const recentDetections = detections.filter((detection) => {
    try {
      return new Date(detection.detected_at) >= fourteenDaysAgo;
    } catch {
      return false;
    }
  });

  if (recentDetections.length === 0) {
    container.innerHTML = '<div class="text-center py-8"><p class="text-gray-600">Not enough data yet</p></div>';
    return;
  }

  // Aggregate by hour and day (Mountain Time)
  const hourlyByDay: Record<string, number[]> = {};

  recentDetections.forEach((detection) => {
    try {
      const date = new Date(detection.detected_at);
      const mtDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Denver" }));
      const hour = mtDate.getHours();
      const dayKey = mtDate.toISOString().split("T")[0]!;

      if (!hourlyByDay[dayKey]) {
        hourlyByDay[dayKey] = new Array(24).fill(0);
      }
      hourlyByDay[dayKey]![hour]++;
    } catch (e) {
      console.error("Error parsing date:", detection.detected_at, e);
    }
  });

  const days = Object.keys(hourlyByDay);
  const numDays = days.length;

  if (numDays === 0) {
    container.innerHTML = '<div class="text-center py-8"><p class="text-gray-600">Not enough data yet</p></div>';
    return;
  }

  const hourlyAverages = Array.from({ length: 24 }, (_, hour) => {
    const sum = days.reduce((acc, dayKey) => acc + hourlyByDay[dayKey]![hour]!, 0);
    return { hour, label: formatChartHour(hour), average: sum / numDays };
  });

  const width = 800;
  const height = 24 * 30;
  const padding = { top: 20, right: 60, bottom: 20, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxAvg = Math.max(...hourlyAverages.map((h) => h.average));
  const barHeight = (chartHeight / 24) * 0.8;
  const barSpacing = chartHeight / 24;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "w-full h-auto");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Average hourly activity bar chart");

  hourlyAverages.forEach((hourData, i) => {
    const barWidth = maxAvg > 0 ? (hourData.average / maxAvg) * chartWidth : 0;
    const x = padding.left;
    const y = padding.top + i * barSpacing + (barSpacing - barHeight) / 2;

    const bar = svgRect(x, y, barWidth, barHeight, "#4A7C2C");
    bar.setAttribute("rx", "2");
    svg.appendChild(bar);

    const hourLabel = svgText(padding.left - 10, y + barHeight / 2, hourData.label, "11px", "#374151", "end");
    hourLabel.setAttribute("dominant-baseline", "middle");
    svg.appendChild(hourLabel);

    if (hourData.average > 0) {
      const avgRounded = Math.round(hourData.average * 10) / 10;
      const countLabel = svgText(x + barWidth + 5, y + barHeight / 2, String(avgRounded), "11px", "#374151", "start");
      countLabel.setAttribute("dominant-baseline", "middle");
      svg.appendChild(countLabel);
    }
  });

  container.innerHTML = "";
  container.appendChild(svg);
}

// --- Explore charts ---------------------------------------------------------

/** Detection timeline (vertical bars, last 30 days) */
export function renderExtendedTimeline(container: Element, data: Array<{ label: string; value: number }>): void {
  const width = 800;
  const height = 400;
  const padding = { top: 20, right: 20, bottom: 80, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxCount = Math.max(...data.map((d) => d.value));
  const barWidth = chartWidth / data.length;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "w-full h-auto");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Extended timeline chart");

  svg.appendChild(svgLine(padding.left, padding.top, padding.left, height - padding.bottom, "#e5e7eb"));
  svg.appendChild(svgLine(padding.left, height - padding.bottom, width - padding.right, height - padding.bottom, "#e5e7eb"));

  data.forEach((d, i) => {
    const barHeight = maxCount > 0 ? (d.value / maxCount) * chartHeight : 0;
    const x = padding.left + i * barWidth + barWidth * 0.1;
    const y = height - padding.bottom - barHeight;
    const barWidthActual = barWidth * 0.8;

    const bar = svgRect(x, y, barWidthActual, barHeight, "#4A7C2C");
    bar.setAttribute("rx", "2");
    svg.appendChild(bar);

    if (d.value > 0 && barWidth > 15) {
      svg.appendChild(svgText(x + barWidthActual / 2, y - 5, String(d.value), "10px", "#374151", "middle"));
    }

    // Show every 3rd date label to avoid crowding
    if (i % 3 === 0 || i === data.length - 1) {
      const dateText = svgText(
        x + barWidthActual / 2,
        height - padding.bottom + 15,
        formatDateShort(d.label),
        "10px",
        "#6b7280",
        "middle",
      );
      dateText.setAttribute("transform", `rotate(-45 ${x + barWidthActual / 2} ${height - padding.bottom + 15})`);
      svg.appendChild(dateText);
    }
  });

  container.innerHTML = "";
  container.appendChild(svg);
}

/** Top species activity (horizontal bars, top 15) */
export function renderSpeciesComparison(container: Element, data: Array<{ label: string; value: number }>): void {
  const width = 700;
  const height = Math.max(400, data.length * 28);
  const padding = { top: 10, right: 60, bottom: 10, left: 180 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxCount = Math.max(...data.map((d) => d.value));
  const barHeight = (chartHeight / data.length) * 0.85;
  const barSpacing = chartHeight / data.length;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "w-full h-auto");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Species comparison chart");

  data.forEach((d, i) => {
    const barWidth = maxCount > 0 ? (d.value / maxCount) * chartWidth : 0;
    const x = padding.left;
    const y = padding.top + i * barSpacing + (barSpacing - barHeight) / 2;

    const bar = svgRect(x, y, barWidth, barHeight, "#7BB3E8");
    bar.setAttribute("rx", "2");
    svg.appendChild(bar);

    const nameLabel = d.label.length > 20 ? d.label.substring(0, 18) + "..." : d.label;
    const label = svgText(padding.left - 10, y + barHeight / 2, nameLabel, "11px", "#374151", "end");
    label.setAttribute("dominant-baseline", "middle");
    svg.appendChild(label);

    const countLabel = svgText(x + barWidth + 5, y + barHeight / 2, String(d.value), "11px", "#374151", "start");
    countLabel.setAttribute("dominant-baseline", "middle");
    svg.appendChild(countLabel);
  });

  container.innerHTML = "";
  container.appendChild(svg);
}

// --- Daily Detections Summary (live page; bar ranking + hourly heatmap) -----

export interface SpeciesHourly {
  name: string;
  total: number;
  hourly: number[]; // 24 counts
}

export interface DailySummaryData {
  species: SpeciesHourly[];
  maxHourly: number;
}

/** Aggregate detections by species and hour (Mountain Time), top 15 species */
export function aggregateSpeciesByHour(detections: Array<{ common_name: string; detected_at: string }>): DailySummaryData {
  const speciesMap = new Map<string, SpeciesHourly>();

  detections.forEach((detection) => {
    try {
      const name = detection.common_name;
      const date = new Date(detection.detected_at);
      const mtDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Denver" }));
      const hour = mtDate.getHours();

      if (!speciesMap.has(name)) {
        speciesMap.set(name, { name, total: 0, hourly: new Array(24).fill(0) });
      }

      const species = speciesMap.get(name)!;
      species.total++;
      species.hourly[hour]!++;
    } catch (e) {
      console.error("Error parsing detection:", detection, e);
    }
  });

  const speciesArray = Array.from(speciesMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  let maxHourly = 0;
  speciesArray.forEach((species) => {
    const max = Math.max(...species.hourly);
    if (max > maxHourly) maxHourly = max;
  });

  return { species: speciesArray, maxHourly };
}

/** Heatmap color ramp: light green → dark green → purple → red */
export function getHeatmapColor(intensity: number): string {
  if (intensity === 0) return "#f9fafb";

  const colorStops = [
    { threshold: 0.0, color: { r: 220, g: 252, b: 231 } },
    { threshold: 0.25, color: { r: 134, g: 239, b: 172 } },
    { threshold: 0.5, color: { r: 34, g: 197, b: 94 } },
    { threshold: 0.65, color: { r: 16, g: 185, b: 129 } },
    { threshold: 0.75, color: { r: 139, g: 92, b: 246 } },
    { threshold: 0.85, color: { r: 220, g: 38, b: 127 } },
    { threshold: 1.0, color: { r: 239, g: 68, b: 68 } },
  ];

  let lowerStop = colorStops[0]!;
  let upperStop = colorStops[1]!;

  for (let i = 0; i < colorStops.length - 1; i++) {
    if (intensity >= colorStops[i]!.threshold && intensity <= colorStops[i + 1]!.threshold) {
      lowerStop = colorStops[i]!;
      upperStop = colorStops[i + 1]!;
      break;
    }
  }

  const range = upperStop.threshold - lowerStop.threshold;
  const normalizedIntensity = (intensity - lowerStop.threshold) / range;

  const r = Math.round(lowerStop.color.r + (upperStop.color.r - lowerStop.color.r) * normalizedIntensity);
  const g = Math.round(lowerStop.color.g + (upperStop.color.g - lowerStop.color.g) * normalizedIntensity);
  const b = Math.round(lowerStop.color.b + (upperStop.color.b - lowerStop.color.b) * normalizedIntensity);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Convert the hourly API response (hours[].species[].count) into the
 * species-by-hour shape renderDailySummary expects (top 15 by total).
 * Ported from live-refresh.js updateDailySummaryChartWithHourlyData.
 */
export function summaryFromHourly(
  hours: Array<{ hour: number; species?: Array<{ common_name: string; count: number }> }>,
): DailySummaryData {
  const speciesMap = new Map<string, SpeciesHourly>();

  hours.forEach((hourRecord) => {
    (hourRecord.species || []).forEach((speciesRecord) => {
      const name = speciesRecord.common_name;
      if (!speciesMap.has(name)) {
        speciesMap.set(name, { name, total: 0, hourly: new Array(24).fill(0) });
      }
      const speciesData = speciesMap.get(name)!;
      speciesData.total += speciesRecord.count;
      speciesData.hourly[hourRecord.hour] = speciesRecord.count;
    });
  });

  const speciesArray = Array.from(speciesMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  let maxHourly = 0;
  speciesArray.forEach((species) => {
    const max = Math.max(...species.hourly);
    if (max > maxHourly) maxHourly = max;
  });

  return { species: speciesArray, maxHourly };
}

/**
 * Daily Detections Summary: species ranking bars + 24-hour heatmap.
 * Matches the live-refresh.js variant (no SVG title/legend — the card
 * heading lives in the surrounding HTML), which is the only one rendered
 * in birdworks; the charts.js variant's container no longer exists.
 */
export function renderDailySummary(
  container: Element,
  data: DailySummaryData,
  updatedStr: string | null,
): void {
  const numSpecies = data.species.length;
  const headerHeight = 60;
  const rowHeight = 32;
  const barChartWidth = 220;
  const cellSize = 28;
  const heatmapWidth = 24 * cellSize;
  const padding = { top: headerHeight + 10, right: 20, bottom: 20, left: 180 };

  const width = padding.left + barChartWidth + 40 + heatmapWidth + padding.right;
  const chartHeight = numSpecies * rowHeight;
  const height = padding.top + chartHeight + padding.bottom;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "w-full h-auto");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Daily detections summary with species ranking and hourly heatmap");

  // Header: just the last-updated stamp (the card heading lives in the page HTML)
  svg.appendChild(
    svgText(padding.left, 45, `Last updated: ${toMountainTime(updatedStr)} MT`, "12px", "#6b7280", "start"),
  );

  const divider = svgLine(padding.left, headerHeight, width - padding.right, headerHeight, "#e5e7eb");
  divider.setAttribute("stroke-width", "2");
  svg.appendChild(divider);

  const maxTotal = Math.max(...data.species.map((s) => s.total));

  // Per-species row: name + ranking bar + heatmap
  data.species.forEach((species, i) => {
    const y = padding.top + i * rowHeight;

    const nameLabel = species.name.length > 22 ? species.name.substring(0, 20) + "..." : species.name;
    const nameText = svgText(padding.left - 10, y + rowHeight / 2, nameLabel, "12px", "#374151", "end");
    nameText.setAttribute("dominant-baseline", "middle");
    svg.appendChild(nameText);

    const barWidth = maxTotal > 0 ? (species.total / maxTotal) * barChartWidth : 0;
    const barY = y + 4;
    const barH = rowHeight - 8;

    const bar = svgRect(padding.left, barY, barWidth, barH, "#4A7C2C");
    bar.setAttribute("rx", "3");
    svg.appendChild(bar);

    if (species.total > 0) {
      const countText = svgText(padding.left + barWidth + 5, y + rowHeight / 2, String(species.total), "11px", "#374151", "start");
      countText.setAttribute("dominant-baseline", "middle");
      countText.setAttribute("font-weight", "bold");
      svg.appendChild(countText);
    }

    const heatmapStartX = padding.left + barChartWidth + 40;
    species.hourly.forEach((count, hour) => {
      const cellX = heatmapStartX + hour * cellSize;
      const cellY = y + 2;
      const cellH = rowHeight - 4;

      if (count > 0) {
        const intensity = count / data.maxHourly;
        const cell = svgRect(cellX, cellY, cellSize - 2, cellH, getHeatmapColor(intensity));
        cell.setAttribute("rx", "2");
        svg.appendChild(cell);

        if (cellSize >= 24) {
          const textColor = intensity > 0.5 ? "#ffffff" : "#374151";
          const countText = svgText(cellX + cellSize / 2 - 1, cellY + cellH / 2, String(count), "9px", textColor, "middle");
          countText.setAttribute("dominant-baseline", "middle");
          countText.setAttribute("font-weight", "bold");
          svg.appendChild(countText);
        }
      } else {
        const cell = svgRect(cellX, cellY, cellSize - 2, cellH, "#f9fafb");
        cell.setAttribute("rx", "2");
        cell.setAttribute("stroke", "#e5e7eb");
        cell.setAttribute("stroke-width", "1");
        svg.appendChild(cell);
      }
    });
  });

  // Hour labels (bottom, every 3 hours)
  const hourLabelsY = padding.top + chartHeight + 18;
  const heatmapStartX = padding.left + barChartWidth + 40;
  for (let hour = 0; hour < 24; hour += 3) {
    const hourX = heatmapStartX + hour * cellSize + cellSize / 2 - 1;
    svg.appendChild(svgText(hourX, hourLabelsY, String(hour), "10px", "#6b7280", "middle"));
  }

  const hourAxisLabel = svgText(heatmapStartX + heatmapWidth / 2, hourLabelsY + 15, "Hour of Day (MT)", "11px", "#6b7280", "middle");
  hourAxisLabel.setAttribute("font-style", "italic");
  svg.appendChild(hourAxisLabel);

  container.innerHTML = "";
  container.appendChild(svg);
}
