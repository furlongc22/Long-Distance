const targetDate = new Date('December 17, 2026 19:00:00').getTime();
const startDate = new Date('August 14, 2026 18:00:00').getTime();

// =====================================
// DATE SETUP (easy to change later)
// =====================================
// Change these two dates if you want to shift the memory schedule.
// RELEASE_DATE = the day the page officially goes live.
// FIRST_MEMORY_DATE = the first memory date that should appear on release day.
// Example: if RELEASE_DATE is 2026-09-20 and FIRST_MEMORY_DATE is 2026-07-11,
// then 2026-09-20 shows July 11, 2026-09-21 shows July 12, and so on.
// If you want 2026-09-20 to start on July 12 instead, change FIRST_MEMORY_DATE to 2026-07-12.
// Rotation settings: each memory shows for 4 days starting from page load date
const WINDOW_DAYS = 4;
const START_DATE = (function(){ const d=new Date(); d.setHours(0,0,0,0); return d; })();
const DAY_IN_MS = 1000 * 60 * 60 * 24;

// MEMORY ROTATION SETTINGS
// Change this to how long each memory stays on screen before auto-rotating.
// Set to 10 for a 10-second rotation, or adjust it to a different value as needed.
const AUTO_ROTATE_SECONDS = 10;

// IMPORTANT:
// This page looks for photo data in memories.json, which is generated from the files in the memories folder.
// After adding or removing photos, run: python generate_memories.py
// from the project folder, then reload the page.
// This keeps each day working automatically without editing this JavaScript file.
let memorySchedule = {};

function sanitizeMemorySlides(slides) {
	return (slides || []).filter((slide) => slide && slide.image && slide.image.trim() !== '');
}

// Debug helper disabled in production
function addDebug(msg) { /* no-op */ }

// --- New rotation logic using MEMORIES_FOLDERS (global) ---
function getMemoryDateKeyForToday(referenceDate = new Date()) {
	// MEMORIES_FOLDERS may be declared with const/let in an inline script (not a property on window).
	const list = (typeof MEMORIES_FOLDERS !== 'undefined') ? MEMORIES_FOLDERS : (window.MEMORIES_FOLDERS || []);
	if (!list || !list.length) {
		try { addDebug('MEMORIES_FOLDERS is missing or empty.'); } catch (e) {}
		return null;
	}
	const daysSinceStart = Math.floor((referenceDate - START_DATE) / DAY_IN_MS);
	const windowIndex = Math.floor(daysSinceStart / WINDOW_DAYS);
	const folderIndex = ((windowIndex % list.length) + list.length) % list.length;
	return list[folderIndex];
}

function resolveMemoryKey(dateKey) {
	if (!memorySchedule || typeof memorySchedule !== 'object') return null;
	if (dateKey in memorySchedule) return dateKey;
	const keys = Object.keys(memorySchedule || {});
	// try contains match (robust to small format differences)
	for (const k of keys) {
		if (k.includes(dateKey) || dateKey.includes(k)) return k;
	}
	// try normalized ISO compare (strip timezone)
	const norm = dateKey.replace(/Z$/,'');
	for (const k of keys) {
		if (k.replace(/Z$/,'') === norm) return k;
	}
	return null;
}

async function loadSummaryForFolder(folderKey) {
	// Return HTML for the folder summary (do not directly mutate DOM here).
	if (!folderKey) return null;
	try {
		const res = await fetch(`memories/${folderKey}/summary.md?t=${Date.now()}`);
		if (!res.ok) throw new Error('no summary');
		const text = await res.text();
		const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
		if (!lines.length) return '';
		let html = '';
		if (lines[0].startsWith('#')) {
			const heading = lines[0].replace(/^#+\s*/, '');
			html += `<div style="font-weight:700;margin-bottom:6px">${heading}</div>`;
			lines.shift();
		}
		if (lines.length) html += '<div>' + lines.join('<br>') + '</div>';
		return html;
	} catch (err) {
		return null;
	}
}

const toggleMediaBtn = { element: null };
let isShowingImage = false;

async function showSummaryView(folderKey) {
	isShowingImage = false;
	if (memoryImage) {
		memoryImage.hidden = true;
		memoryImage.removeAttribute('src');
		memoryImage.style.display = 'none';
	}
	// Render summary into the image spot so text appears where the photo would be
	if (memoryFallback) {
		const html = await loadSummaryForFolder(folderKey);
		if (html === null) {
			memoryFallback.innerHTML = '<p>Your photo, quote, or letter goes here.</p>';
		} else if (html === '') {
			// empty summary file
			memoryFallback.innerHTML = '<em>No summary yet — add summary.md in the folder.</em>';
		} else {
			memoryFallback.innerHTML = html;
		}
		// Make the summary occupy the full memory area (hide image)
		memoryFallback.style.display = 'block';
		memoryFallback.style.width = '100%';
		memoryFallback.style.alignItems = 'flex-start';
		memoryFallback.style.justifyContent = 'flex-start';
		memoryFallback.style.padding = '16px';
	}
	// Hide the lower caption when showing spot summary
	if (memoryCaption) memoryCaption.textContent = '';
	if (toggleMediaBtn.element) toggleMediaBtn.element.textContent = activeMemorySlides.length ? 'Show photo' : '';
	if (memoryCounter) memoryCounter.textContent = activeMemorySlides.length ? `1 / ${activeMemorySlides.length}` : '0 / 0';
	// When showing text summary, always hide the Next button
	if (nextMemoryButton) nextMemoryButton.hidden = true;
}

function showImageView(index=0) {
	if (!activeMemorySlides.length) return;
	isShowingImage = true;
	const slide = activeMemorySlides[index];
	if (slide && slide.image) {
		memoryImage.src = slide.image;
		memoryImage.alt = slide.title || 'Memory photo';
		// Make the image fill the memory area
		memoryImage.hidden = false;
		memoryImage.style.display = 'block';
		memoryImage.style.width = '100%';
		memoryImage.style.height = 'auto';
	}
	if (memoryCaption) memoryCaption.textContent = slide && slide.description ? slide.description : '';
	if (memoryCounter) memoryCounter.textContent = `${index + 1} / ${activeMemorySlides.length}`;
	if (memoryFallback) memoryFallback.style.display = 'none';
	if (nextMemoryButton) nextMemoryButton.hidden = activeMemorySlides.length <= 1;
	if (toggleMediaBtn.element) toggleMediaBtn.element.textContent = 'Show text';
}

async function loadMemorySchedule() {
	try {
		const response = await fetch(`memories.json?t=${Date.now()}`);
		if (!response.ok) {
			throw new Error(`Failed to load memories.json: ${response.status}`);
		}

		const data = await response.json();
		memorySchedule = data && typeof data === 'object' ? data : {};
	} catch (error) {
		console.warn('Could not load memories.json. Run python generate_memories.py after adding/removing photos.', error);
		addDebug('Could not load memories.json: ' + (error && error.message ? error.message : String(error)));
		if (location && location.protocol === 'file:') addDebug('file:// detected — you must run a local HTTP server (Live Server) to use fetch().');
		memorySchedule = {};
	}

	await loadMemorySet();
}

const planeLeft = document.getElementById('plane-left');
const planeRight = document.getElementById('plane-right');
const leftSolid = document.getElementById('line-left-solid');
const rightSolid = document.getElementById('line-right-solid');
const memoryImage = document.getElementById('memory-image');
const memoryCaption = document.getElementById('memory-caption');
const memoryDateLabel = document.getElementById('memory-date-label');
const memoryCounter = document.getElementById('memory-counter');
const nextMemoryButton = document.getElementById('next-memory-btn');
const memoryFallback = document.getElementById('memory-fallback');

// Image load/error diagnostics
if (memoryImage) {
	memoryImage.addEventListener('error', () => {
		addDebug('Image failed to load: ' + (memoryImage.src || '(no src)'));
		memoryImage.hidden = true;
		if (memoryFallback) memoryFallback.style.display = 'flex';
	});
	memoryImage.addEventListener('load', () => {
		addDebug('Image loaded: ' + (memoryImage.src || '(no src)'));
	});
}

let arrivalTriggered = false;
let activeMemoryDateKey = null;
let activeMemorySlides = [];
let currentMemoryIndex = 0;
let autoRotateTimer = null;



function showMemory(index) {
	if (!activeMemorySlides.length) {
		if (memoryDateLabel) memoryDateLabel.textContent = 'No memories scheduled yet';
		if (memoryCounter) memoryCounter.textContent = '0 / 0';
		if (memoryCaption) memoryCaption.textContent = 'Add a new date folder with pictures to begin.';
		if (memoryFallback) memoryFallback.style.display = 'flex';
		if (memoryImage) {
			memoryImage.hidden = true;
			memoryImage.removeAttribute('src');
		}
		if (nextMemoryButton) nextMemoryButton.hidden = true;
		return;
	}

	const slide = activeMemorySlides[index];
	if (!slide) return;

	if (memoryDateLabel && activeMemoryDateKey) {
 		const displayDate = new Date(`${activeMemoryDateKey}T12:00:00`);
 		memoryDateLabel.textContent = `${displayDate.getMonth()+1}/${displayDate.getDate()}`;
	}

	if (memoryCaption) memoryCaption.textContent = slide.description;
	if (memoryCounter) memoryCounter.textContent = `${index + 1} / ${activeMemorySlides.length}`;
	if (memoryFallback) memoryFallback.style.display = 'none';

	if (nextMemoryButton) {
		nextMemoryButton.hidden = activeMemorySlides.length <= 1;
	}

	if (memoryImage) {
		if (slide.image) {
			memoryImage.src = slide.image;
			memoryImage.alt = slide.title || 'Memory photo';
			memoryImage.hidden = false;
		} else {
			memoryImage.hidden = true;
			memoryImage.removeAttribute('src');
		}
	}
}

function resetAutoRotateTimer() {
	if (autoRotateTimer) {
		window.clearInterval(autoRotateTimer);
	}

	if (activeMemorySlides.length <= 1) {
		return;
	}

	autoRotateTimer = window.setInterval(() => {
		if (!activeMemorySlides.length) return;
		currentMemoryIndex = (currentMemoryIndex + 1) % activeMemorySlides.length;
		showMemory(currentMemoryIndex);
	}, AUTO_ROTATE_SECONDS * 1000);
}

async function loadMemorySet() {
	activeMemoryDateKey = getMemoryDateKeyForToday();
	// Attempt to resolve a matching key in memorySchedule
	const resolvedKey = activeMemoryDateKey ? resolveMemoryKey(activeMemoryDateKey) : null;
	if (activeMemoryDateKey && !resolvedKey) {
		console.info('No exact key for', activeMemoryDateKey, 'available keys:', Object.keys(memorySchedule || {}));
		addDebug('No exact key for ' + activeMemoryDateKey + ' in memories.json. Available keys: ' + JSON.stringify(Object.keys(memorySchedule || {})));
	}
	activeMemorySlides = sanitizeMemorySlides(resolvedKey ? memorySchedule[resolvedKey] || [] : []);
	// If no slides found in the JSON, try to probe the folder for common image names as a fallback.
	if ((!activeMemorySlides || !activeMemorySlides.length) && activeMemoryDateKey) {
		console.info('No slides found in memories.json for', activeMemoryDateKey, '- probing folder for images');
		addDebug('No slides in memories.json for ' + activeMemoryDateKey + ' — probing folder for images');
		const probed = await probeFolderForImages(activeMemoryDateKey);
		if (probed && probed.length) {
			activeMemorySlides = probed;
			addDebug('Probed slides for ' + activeMemoryDateKey + ': ' + probed.length + ' found');
		}
		else {
			addDebug('Probe found 0 images in folder: memories/' + activeMemoryDateKey);
		}
	}
	currentMemoryIndex = 0;

	// Update date label
	if (memoryDateLabel && activeMemoryDateKey) {
		const displayDate = new Date(`${activeMemoryDateKey}T12:00:00`);
		memoryDateLabel.textContent = `${displayDate.getMonth()+1}/${displayDate.getDate()}`;
	}

	// Default view shows the summary first (use resolved key if available)
	await showSummaryView(resolvedKey || activeMemoryDateKey);

	// Prepare image area if slides exist (do NOT preload or show image)
	if (activeMemorySlides.length) {
		// ensure the image is hidden by default and not preloaded
		if (memoryImage) {
			memoryImage.removeAttribute('src');
			memoryImage.alt = '';
			memoryImage.hidden = true;
			memoryImage.style.display = 'none';
		}
		if (toggleMediaBtn && toggleMediaBtn.element === null) {
			const el = document.getElementById('toggle-media-btn');
			if (el) { toggleMediaBtn.element = el; el.hidden = false; el.addEventListener('click', () => {
				if (!isShowingImage) showImageView(currentMemoryIndex); else showSummaryView(activeMemoryDateKey);
			}); }
		}
	} else {
		// ensure toggle is hidden when no images
		const el = document.getElementById('toggle-media-btn'); if (el) el.hidden = true;
	}

	// If no summary file was found, fallback to first slide description so some text appears
	if (activeMemorySlides.length && memoryCaption) {
		const html = (memoryCaption.innerHTML || '').toLowerCase();
		if (html.includes('no summary yet') || html.trim() === '') {
			const first = activeMemorySlides[0];
			if (first && first.description) {
				memoryCaption.textContent = first.description;
			}
		}
	}

	// Debug info: expose current schedule state in the console and debug panel
	console.log('memorySchedule keys:', Object.keys(memorySchedule || {}));
	console.log('activeMemoryDateKey:', activeMemoryDateKey, 'resolvedKey:', resolvedKey, 'slides:', activeMemorySlides.length);
	addDebug('memorySchedule keys: ' + JSON.stringify(Object.keys(memorySchedule || {})));
	addDebug('activeMemoryDateKey: ' + activeMemoryDateKey + ' resolvedKey: ' + resolvedKey + ' slides: ' + (activeMemorySlides && activeMemorySlides.length ? activeMemorySlides.length : 0));
}

// Probe a folder for common image filenames and return an array of slide objects.
async function probeFolderForImages(folderKey) {
	if (!folderKey) return [];
	const candidates = [];
	// try numbers 01..12 with common extensions
	const exts = ['jpg','jpeg','png','webp'];
	for (let i = 1; i <= 12; i++) {
		const names = [];
		const pad = i < 10 ? `0${i}` : `${i}`;
		names.push(pad);
		names.push(`${i}`);
		for (const nm of names) {
			for (const ext of exts) {
				candidates.push(`memories/${folderKey}/${nm}.${ext}`);
			}
		}
	}

	const found = [];
	for (const url of candidates) {
		try {
			// Use HEAD to avoid downloading full images when possible
			const res = await fetch(url, { method: 'HEAD' });
			if (res && res.ok) {
				found.push({ title: '', description: '', image: url });
			}
		} catch (err) {
			// Some servers may not accept HEAD; try GET as a fallback
			try {
				const res2 = await fetch(url);
				if (res2 && res2.ok) {
					found.push({ title: '', description: '', image: url });
				}
			} catch (e) {
				// ignore
			}
		}
		// stop if we've found a reasonable number
		if (found.length >= 12) break;
	}
	return found;
}

if (nextMemoryButton) {
	nextMemoryButton.addEventListener('click', () => {
		if (!activeMemorySlides.length) return;
		currentMemoryIndex = (currentMemoryIndex + 1) % activeMemorySlides.length;
		showMemory(currentMemoryIndex);
		resetAutoRotateTimer();
	});
}

loadMemorySchedule();

function triggerArrivalEffects() {
	if (arrivalTriggered) return;
	arrivalTriggered = true;

	const container = document.querySelector('.container');
	const msg = document.getElementById('arrival-message');
	if (container) container.classList.add('arrived');
	if (msg) msg.classList.add('show');
	launchConfetti();
}

function updateCountdown() {
	const now = Date.now();
	const difference = targetDate - now;

	// Update numeric countdown
	if (difference <= 0) {
		document.getElementById('days').textContent = 0;
		document.getElementById('hours').textContent = 0;
		document.getElementById('minutes').textContent = 0;
		document.getElementById('seconds').textContent = 0;
	} else {
		const days = Math.floor(difference / (1000 * 60 * 60 * 24));
		const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
		const minutes = Math.floor((difference / (1000 * 60)) % 60 );
		const seconds = Math.floor((difference / (1000 )) % 60 );

		document.getElementById('days').textContent = days;
		document.getElementById('hours').textContent = hours;
		document.getElementById('minutes').textContent = minutes;
		document.getElementById('seconds').textContent = seconds;
	}

	// Update journey graphic
	const total = targetDate - startDate;
	let progress = 1;
	if (total > 0) {
		progress = (now - startDate) / total;
		progress = Math.max(0, Math.min(1, progress));
	}

	// endpoints - percentage from left (0..1) where the visible dot sits
	const endpointLeftPct = 0.88; // 88% from left

	// left plane moves from left flag (0%) to endpoint
	if (planeLeft) {
		const leftPos = progress * endpointLeftPct * 100;
		planeLeft.style.left = `${leftPos}%`;
	}
	if (leftSolid) {
		leftSolid.style.width = `${progress * endpointLeftPct * 100}%`;
	}

	// right plane moves from right flag (100%) toward endpoint on left side
	if (planeRight) {
		const rightPos = (1 - (progress * endpointLeftPct)) * 100;
		planeRight.style.left = `${rightPos}%`;
	}
	if (rightSolid) {
		rightSolid.style.width = `${progress * endpointLeftPct * 100}%`;
	}

	// When finished, ensure lines are full and planes at center and trigger arrival once
	if (difference <= 0) {
		if (leftSolid) leftSolid.style.width = `${endpointLeftPct * 100}%`;
		if (rightSolid) rightSolid.style.width = `${endpointLeftPct * 100}%`;
		if (planeLeft) planeLeft.style.left = `${endpointLeftPct * 100}%`;
		if (planeRight) planeRight.style.left = `${(1 - endpointLeftPct) * 100}%`;
		triggerArrivalEffects();
	}
}

updateCountdown();
setInterval(updateCountdown, 1000);

/* Confetti implementation */
function launchConfetti() {
	const canvas = document.getElementById('confetti-canvas');
	if (!canvas) return;
	const ctx = canvas.getContext('2d');
	let W = canvas.width = window.innerWidth;
	let H = canvas.height = window.innerHeight;

	const colors = ['#f6c1d8','#f08fb3','#bfead5','#67c08a','#d4af37'];
	const pieces = [];
	const count = 140;
	const duration = 5000; // ms
	const start = performance.now();

	for (let i=0;i<count;i++) {
		pieces.push({
			x: W/2 + (Math.random()-0.5)*200,
			y: H/2 + (Math.random()-0.5)*80,
			vx: (Math.random()-0.5) * 6,
			vy: - (Math.random()*6 + 2),
			size: Math.random()*8 + 6,
			color: colors[Math.floor(Math.random()*colors.length)],
			rotation: Math.random()*360,
			dRot: (Math.random()-0.5)*6
		});
	}

	function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
	window.addEventListener('resize', resize);

	function draw(now) {
		const t = now - start;
		ctx.clearRect(0,0,W,H);
		for (let i=0;i<pieces.length;i++) {
			const p = pieces[i];
			p.vy += 0.12; // gravity
			p.x += p.vx;
			p.y += p.vy;
			p.rotation += p.dRot;

			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate(p.rotation * Math.PI/180);
			ctx.fillStyle = p.color;
			ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.6);
			ctx.restore();
		}

		if (t < duration) {
			requestAnimationFrame(draw);
		} else {
			ctx.clearRect(0,0,W,H);
			window.removeEventListener('resize', resize);
		}
	}

	requestAnimationFrame(draw);
}

