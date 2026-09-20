const targetDate = new Date('December 17, 2026 19:00:00').getTime();
const startDate = new Date('August 14, 2026 18:00:00').getTime();

const planeLeft = document.getElementById('plane-left');
const planeRight = document.getElementById('plane-right');
const leftSolid = document.getElementById('line-left-solid');
const rightSolid = document.getElementById('line-right-solid');

let arrivalTriggered = false;

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

