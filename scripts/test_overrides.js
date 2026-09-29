// Test script to validate TEMP_OVERRIDES and rotation mapping
const MEMORIES_FOLDERS = ['2026-08-14','2026-08-13','2026-08-12','2026-08-11','2026-08-10','2026-08-09','2026-08-08','2026-08-07','2026-08-06','2026-08-05','2026-08-04','2026-08-03','2026-08-02','2026-07-22','2026-07-21','2026-07-20','2026-07-19','2026-07-17','2026-07-16','2026-07-15','2026-07-13','2026-07-12','2026-07-11'];
const START_DATE = new Date('2026-09-20T00:00:00');
const WINDOW_DAYS = 4;
const DAY_IN_MS = 1000 * 60 * 60 * 24;
const TEMP_OVERRIDES = [
  { start: new Date('2026-09-28T00:00:00'), end: new Date('2026-10-01T23:59:59.999'), folder: '2026-08-13' },
  { start: new Date('2026-10-02T00:00:00'), end: new Date('2026-10-04T23:59:59.999'), folder: '2026-08-12' },
  { start: new Date('2026-10-05T00:00:00'), end: new Date('2026-10-07T23:59:59.999'), folder: '2026-08-11' },
  { start: new Date('2026-10-08T00:00:00'), end: new Date('2026-10-10T23:59:59.999'), folder: '2026-08-10' },
  { start: new Date('2026-10-11T00:00:00'), end: new Date('2026-10-13T23:59:59.999'), folder: '2026-08-09' },
  { start: new Date('2026-10-14T00:00:00'), end: new Date('2026-10-17T23:59:59.999'), folder: '2026-08-08' }
];

function getMemoryDateKeyForToday(referenceDate = new Date()) {
  try {
    if (Array.isArray(TEMP_OVERRIDES)) {
      const ref = new Date(referenceDate);
      for (const o of TEMP_OVERRIDES) {
        if (!o || !o.start || !o.end || !o.folder) continue;
        const s = new Date(o.start);
        const e = new Date(o.end);
        if (ref >= s && ref <= e) return o.folder;
      }
    }
  } catch (e) {}
  const list = MEMORIES_FOLDERS || [];
  if (!list.length) return null;
  const daysSinceStart = Math.floor((referenceDate - START_DATE) / DAY_IN_MS);
  const windowIndex = Math.floor(daysSinceStart / WINDOW_DAYS);
  const folderIndex = ((windowIndex % list.length) + list.length) % list.length;
  return list[folderIndex];
}

function fmt(d){ return d.toISOString().slice(0,10); }

const start = new Date('2026-09-28T00:00:00');
const end = new Date('2026-10-17T00:00:00');
for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
  console.log(fmt(d), '->', getMemoryDateKeyForToday(new Date(d)));
}
