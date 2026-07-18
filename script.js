
        const Engine = Matter.Engine,
            Render = Matter.Render,
            Runner = Matter.Runner,
            Bodies = Matter.Bodies,
            Composite = Matter.Composite,
            Events = Matter.Events,
            Body = Matter.Body;

        let engine, render, runner;
        let redName = '',
            blueName = '';
        let currentRound = 0;
        let score = { red: 0, blue: 0 };
        let gameState = 'IDLE';
        let activeBodies = [];
        let sparks = [];
        let roundStartTime = 0;

        // 杩借釜鏍稿績纰庡潡锛堝喅瀹氳儨璐熺殑瀵硅薄锛?
        let trackedBody = { red: null, blue: null };

        const BASE_SIZE = 90;
        const FONT_SIZE = 76;
        const width = 600,
            height = 600,
            cx = width / 2,
            cy = height / 2,
            radius = 280;

        // 杞€熺浉鍏冲父閲?
        const STOP_THRESHOLD = 0.01; // 宸插純鐢紝浠呬綔涓哄弬鑰冧繚鐣?
        const DECAY_DANGER_ZONE = 0.02;
        const FINAL_ZERO_THRESHOLD = 0.0002; // 杞€熶綆浜庤鍊兼椂鐩存帴褰掗浂
        const COLLISION_RETAIN = 0.999995;
        const INITIAL_SPIN_BASE = 1;      // 澶у箙闄嶄綆
        const INITIAL_SPIN_RANDOM = 0.1;

        // 骞崇Щ閫熷害鐩稿叧甯搁噺
        const LINEAR_DRAG = 0.99;
        const SPIN_LINEAR_COUPLING_POWER = 0.35;

        // 纰庤鏋佺绋嬪害
        const SHATTER_EXTREME_POWER = 2.6;

        // 涓磋繎鍋滄鍔犻€熻“鍑忓嚱鏁帮紙浠嶄繚鐣欙紝鐢ㄤ簬蹇€熼檷鍒板綊闆堕槇鍊奸檮杩戯級
        function getExtraDecayFactor(angularVelocity) {
            let speed = Math.abs(angularVelocity);
            if (speed >= DECAY_DANGER_ZONE) return 1;
            let t = 1 - (speed - STOP_THRESHOLD) / (DECAY_DANGER_ZONE - STOP_THRESHOLD);
            t = Math.max(0, Math.min(1, t));
            let extraLoss = t * t * 0.08;
            return 1 - extraLoss;
        }

        const pageInput = document.getElementById('page-input');
        const pageBattle = document.getElementById('page-battle');
        const errorMsg = document.getElementById('input-error');
        const btnGotoBattle = document.getElementById('btn-goto-battle');
        const btnNextRound = document.getElementById('btn-next-round');
        const btnBackInput = document.getElementById('btn-back-input');
        const gameContainer = document.getElementById('game-container');
        const statusEl = document.getElementById('battle-status');

        function fitBattleScale() {
            const inner = document.getElementById('battle-scale-inner');
            const outer = document.getElementById('battle-scale-outer');
            if (!inner || !outer || pageBattle.style.display === 'none') return;
            inner.style.transform = 'none';
            const naturalW = inner.offsetWidth;
            const naturalH = inner.offsetHeight;
            if (naturalW === 0 || naturalH === 0) return;
            const availW = window.innerWidth * 0.96;
            const availH = window.innerHeight * 0.96;
            const scale = Math.min(1, availW / naturalW, availH / naturalH);
            inner.style.transform = `scale(${scale})`;
            inner.style.transformOrigin = 'top center';
            outer.style.height = (naturalH * scale) + 'px';
        }
        window.addEventListener('resize', fitBattleScale);
        window.addEventListener('orientationchange', () => setTimeout(fitBattleScale, 100));

        // 绀艰姳绯荤粺
        const confettiCanvas = document.getElementById('confetti-canvas');
        const confettiCtx = confettiCanvas.getContext('2d');
        let confettiParticles = [];
        let confettiAnimRunning = false;

        function resizeConfettiCanvas() {
            confettiCanvas.width = window.innerWidth;
            confettiCanvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeConfettiCanvas);
        resizeConfettiCanvas();

        function spawnConfetti(x, y, options = {}) {
            const { count = 60, colors = ['#b9483f', '#35688a', '#e3b23c', '#6fae6a', '#ffffff'], spread = 8, gravity = 0.15,
                big = false } = options;
            for (let i = 0; i < count; i++) {
                let angle = Math.random() * Math.PI * 2;
                let speed = (0.3 + Math.random()) * spread;
                confettiParticles.push({
                    x,
                    y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - spread * 0.4,
                    size: (big ? 6 : 4) + Math.random() * (big ? 6 : 4),
                    color: colors[Math.floor(Math.random() * colors.length)],
                    rotation: Math.random() * Math.PI * 2,
                    vr: (Math.random() - 0.5) * 0.3,
                    life: 1.0,
                    decay: 0.008 + Math.random() * 0.006,
                    gravity
                });
            }
            if (!confettiAnimRunning) {
                confettiAnimRunning = true;
                requestAnimationFrame(updateConfetti);
            }
        }

        function updateConfetti() {
            confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
            for (let i = confettiParticles.length - 1; i >= 0; i--) {
                let p = confettiParticles[i];
                p.vy += p.gravity;
                p.x += p.vx;
                p.y += p.vy;
                p.rotation += p.vr;
                p.life -= p.decay;
                if (p.life <= 0 || p.y > confettiCanvas.height + 60) {
                    confettiParticles.splice(i, 1);
                    continue;
                }
                confettiCtx.save();
                confettiCtx.globalAlpha = Math.max(0, p.life);
                confettiCtx.translate(p.x, p.y);
                confettiCtx.rotate(p.rotation);
                confettiCtx.fillStyle = p.color;
                confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                confettiCtx.restore();
            }
            if (confettiParticles.length > 0) {
                requestAnimationFrame(updateConfetti);
            } else {
                confettiAnimRunning = false;
            }
        }

        function celebrateRoundWinner(team) {
            const rosterEl = document.getElementById(team === 'red' ? 'roster-red' : 'roster-blue');
            const rect = rosterEl.getBoundingClientRect();
            spawnConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, { count: 45, spread: 7, gravity: 0.18,
                big: false });
        }

        function celebrateMatchWinner() {
            const redRect = document.getElementById('roster-red').getBoundingClientRect();
            const blueRect = document.getElementById('roster-blue').getBoundingClientRect();
            spawnConfetti(redRect.left + redRect.width / 2, redRect.top + redRect.height / 2, { count: 100, spread: 11,
                gravity: 0.12, big: true });
            spawnConfetti(blueRect.left + blueRect.width / 2, blueRect.top + blueRect.height / 2, { count: 100, spread: 11,
                gravity: 0.12, big: true });
            spawnConfetti(window.innerWidth / 2, window.innerHeight * 0.15, { count: 140, spread: 13, gravity: 0.1,
                big: true });
        }

        function getCharComplexity(char) {
            const c = document.createElement('canvas');
            const ctx = c.getContext('2d', { willReadFrequently: true });
            c.width = 100;
            c.height = 100;
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, 100, 100);
            ctx.font = `bold ${FONT_SIZE}px 'Source Serif Pro', Georgia, serif`;
            ctx.fillStyle = "#000";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(char, 50, 50);
            const imgData = ctx.getImageData(0, 0, 100, 100).data;
            let darkPixels = 0;
            for (let i = 0; i < imgData.length; i += 4) {
                if (imgData[i] < 128) darkPixels++;
            }
            return darkPixels;
        }

        function isChinese(str) { return /^[\u4e00-\u9fa5]+$/.test(str); }

        btnGotoBattle.addEventListener('click', () => {
            const rName = document.getElementById('red-name').value.trim();
            const bName = document.getElementById('blue-name').value.trim();
            if (rName.length < 1 || rName.length > 5 || bName.length < 1 || bName.length > 5) {
                errorMsg.textContent = '鐘锛氬瓧鏁板繀椤诲湪 1 鍒?5 涓瓧绗︿箣闂达紒';
                return;
            }
            if (!isChinese(rName) || !isChinese(bName)) {
                errorMsg.textContent = '鐘锛氬繀椤昏緭鍏ョ函姹夊瓧锛?;
                return;
            }
            if (rName.length !== bName.length) {
                errorMsg.textContent = `鐘锛氬弻鏂瑰瓧鏁板繀椤诲绛夛紒(绾?{rName.length}锛岃摑${bName.length})`;
                return;
            }
            redName = rName;
            blueName = bName;
            errorMsg.textContent = '';
            currentRound = 0;
            score = { red: 0, blue: 0 };
            pageInput.style.display = 'none';
            pageBattle.style.display = 'block';
            buildRosterUI();
            updateScoreboard();
            statusEl.textContent = '鍑嗗灏辩华';
            btnNextRound.textContent = '寮€濮嬬 1 鍥炲悎';
            btnNextRound.style.display = 'block';
            initPhysics();
            gameState = 'ROUND_OVER';
            requestAnimationFrame(fitBattleScale);
        });

        function resetBattleState() {
            if (render) {
                Render.stop(render);
            }
            if (runner) {
                Runner.stop(runner);
            }
            if (engine) {
                engine.events = {};
            }
            if (gameContainer) {
                gameContainer.innerHTML = '';
            }
            const inner = document.getElementById('battle-scale-inner');
            const outer = document.getElementById('battle-scale-outer');
            if (inner) {
                inner.style.transform = 'none';
            }
            if (outer) {
                outer.style.height = 'auto';
            }
            engine = null;
            render = null;
            runner = null;
            activeBodies = [];
            sparks = [];
            trackedBody = { red: null, blue: null };
            gameState = 'IDLE';
            btnNextRound.disabled = false;
            btnNextRound.textContent = '寮€濮嬪洖鍚?;
            statusEl.textContent = '绛夊緟寮€鎴?..';
        }

        function resetToInputPage() {
            resetBattleState();
            pageBattle.style.display = 'none';
            pageInput.style.display = 'flex';
        }

        btnBackInput.addEventListener('click', () => {
            resetToInputPage();
        });
 
        btnNextRound.addEventListener('click', () => {
            if (gameState === 'ROUND_OVER') startNextRound();
        });

        function buildRosterUI() {
            let rr = '',
                rb = '';
            for (let i = 0; i < redName.length; i++) {
                rr += `<span id="r-char-${i}" class="char-box">${redName[i]}</span>`;
                rb += `<span id="b-char-${i}" class="char-box">${blueName[i]}</span>`;
            }
            document.getElementById('roster-red').innerHTML = rr;
            document.getElementById('roster-blue').innerHTML = rb;
        }

        function updateRosterHighlight() {
            for (let i = 0; i < redName.length; i++) {
                document.getElementById(`r-char-${i}`).className = 'char-box';
                document.getElementById(`b-char-${i}`).className = 'char-box';
            }
            if (currentRound < redName.length) {
                document.getElementById(`r-char-${currentRound}`).classList.add('red-active');
                document.getElementById(`b-char-${currentRound}`).classList.add('blue-active');
            }
        }

        function updateScoreboard() {
            document.getElementById('score-red').textContent = score.red;
            document.getElementById('score-blue').textContent = score.blue;
        }

        function startNextRound() {
            if (currentRound >= redName.length) {
                gameState = 'GAME_OVER';
                let winner = score.red > score.blue ? '绾㈡柟鑾疯儨锛? : (score.blue > score.red ? '钃濇柟鑾疯儨锛? : '骞冲眬锛?);
                statusEl.textContent = `姣旇禌缁撴潫锛?{winner}`;
                btnNextRound.style.display = 'none';
                if (score.red !== score.blue) {
                    celebrateMatchWinner();
                    setTimeout(() => {
                        resetToInputPage();
                    }, 2200);
                }
                return;
            }
            gameState = 'PLAYING';
            btnNextRound.disabled = true;
            let rChar = redName[currentRound],
                bChar = blueName[currentRound];
            let rMass = getCharComplexity(rChar),
                bMass = getCharComplexity(bChar);

            // 銆愭柊澧炪€戣绠楀疄闄呯墿鐞嗚川閲忕敤浜庢樉绀?
            let rDensity = 0.15 * (rMass / 1500);
            let bDensity = 0.15 * (bMass / 1500);
            let rFinalMass = Math.round(rDensity * BASE_SIZE * BASE_SIZE+3000);
            let bFinalMass = Math.round(bDensity * BASE_SIZE * BASE_SIZE+3000);

            statusEl.innerHTML = `绗?${currentRound + 1} 鍥炲悎... <span style="font-size:0.8rem"> (绾㈣川:${rFinalMass} 钃濊川:${bFinalMass})</span>`;
            updateRosterHighlight();
            spawnTops(rChar, bChar, rMass, bMass);
            roundStartTime = Date.now();
            currentRound++;
        }

        function initPhysics() {
            engine = Engine.create({ gravity: { x: 0, y: 0 } });
            render = Render.create({
                element: gameContainer,
                engine: engine,
                options: { width: width, height: height, wireframes: false, background: 'transparent' }
            });
            const parts = [];
            for (let i = 0; i < 36; i++) {
                const angle = (i / 36) * Math.PI * 2;
                parts.push(Bodies.rectangle(
                    cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius,
                    60, 30, { isStatic: true, angle: angle, render: { visible: false } }
                ));
            }
            Composite.add(engine.world, parts);

            Events.on(render, 'afterRender', function() {
                const ctx = render.context;
                activeBodies.forEach(body => {
                    ctx.save();
                    ctx.globalAlpha = body.isActiveTop ? 1.0 : 0.4;
                    ctx.translate(body.position.x, body.position.y);
                    ctx.rotate(body.angle);
                    const speed = Math.abs(body.angularVelocity);
                    if (speed > 0.1 && body.isActiveTop) {
                        ctx.transform(1, 0, speed * 0.3 * Math.sin(engine.timing.timestamp * 0.01), 1, 0, 0);
                    }
                    if (body.isFragment) {
                        ctx.beginPath();
                        let fw = body.customStyle.fragW || BASE_SIZE / 2;
                        let fh = body.customStyle.fragH || BASE_SIZE / 2;
                        ctx.rect(-fw / 2, -fh / 2, fw, fh);
                        ctx.clip();
                        ctx.translate(-body.customStyle.offsetX, -body.customStyle.offsetY);
                    }
                    ctx.font = `bold ${FONT_SIZE}px 'Source Serif Pro', Georgia, serif`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = body.customStyle.depthColor;
                    for (let i = 1; i <= 10; i++) { ctx.fillText(body.customStyle.char, -i, i); }
                    ctx.fillStyle = body.customStyle.faceColor;
                    ctx.fillText(body.customStyle.char, 0, 0);
                    if (speed < 0.1 && speed > 0.01 && !body.isFragment) {
                        ctx.beginPath();
                        ctx.moveTo(0, -15);
                        ctx.lineTo(10, 10);
                        ctx.lineTo(-15, 20);
                        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }
                    ctx.restore();
                    if (body.isLargest && body.isActiveTop) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.setLineDash([4, 4]);
                        ctx.strokeStyle = body.customStyle.team === 'red' ? 'rgba(169,53,46,0.5)' :
                            'rgba(40,87,119,0.5)';
                        ctx.lineWidth = 2;
                        ctx.arc(body.position.x, body.position.y, BASE_SIZE * 0.6, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();
                    }
                });
                for (let i = sparks.length - 1; i >= 0; i--) {
                    let p = sparks[i];
                    ctx.globalAlpha = p.life;
                    ctx.fillStyle = '#ffb347';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
                    ctx.fill();
                    p.x += p.vx;
                    p.y += p.vy;
                    p.life -= 0.05;
                    if (p.life <= 0) sparks.splice(i, 1);
                }
                ctx.globalAlpha = 1.0;
            });

            let toShatter = new Set();
            Events.on(engine, 'collisionStart', function(event) {
                if (gameState !== 'PLAYING') return;
                event.pairs.forEach(pair => {
                    let A = pair.bodyA,
                        B = pair.bodyB;
                    if (A.isTopPart && B.isTopPart) {
                        const collisionPoint = pair.collision.supports[0] || A.position;
                        for (let i = 0; i < 10; i++) {
                            sparks.push({
                                x: collisionPoint.x,
                                y: collisionPoint.y,
                                vx: (Math.random() - 0.5) * 15,
                                vy: (Math.random() - 0.5) * 15,
                                life: 1.0,
                                size: Math.random() * 4 + 1
                            });
                        }
                        let speedA = Math.abs(A.velocity.x) + Math.abs(A.velocity.y) + Math.abs(A.angularVelocity) *
                            15;
                        let speedB = Math.abs(B.velocity.x) + Math.abs(B.velocity.y) + Math.abs(B.angularVelocity) *
                            15;
                        let impact = (speedA + speedB) / 3;
                        let shatterProb = Math.min(0.3, 0.3 * (impact / 35));
                        if (!A.isFragment && A.isActiveTop && Math.random() < shatterProb) toShatter.add(A);
                        if (!B.isFragment && B.isActiveTop && Math.random() < shatterProb) toShatter.add(B);
                        Body.setAngularVelocity(A, A.angularVelocity * COLLISION_RETAIN);
                        Body.setAngularVelocity(B, B.angularVelocity * COLLISION_RETAIN);
                    }
                });
                toShatter.forEach(b => shatterBody(b));
                toShatter.clear();
            });

            Events.on(engine, 'beforeUpdate', function() {
                if (gameState !== 'PLAYING') return;
                activeBodies.forEach(body => {
                    if (!body.isActiveTop) return;
                    // 鐩嗗湴寮曞姏
                    let dx = cx - body.position.x;
                    let dy = cy - body.position.y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 30) {
                        let force = 0.00012 * body.mass;
                        Body.applyForce(body, body.position, { x: (dx / dist) * force, y: (dy / dist) *
                                force });
                    }
                    // 杞€熻“鍑忥紝骞跺己鍒跺綊闆?
                    let massFactor = 1;
                    if (body.customStyle.coreMass) {
                        let normalizedMass = Math.min(1, body.customStyle.coreMass / (BASE_SIZE * BASE_SIZE * 0.08));
                        massFactor = 0.98 + 0.02 * normalizedMass;
                    }
                    let newAngVel = body.angularVelocity * body.customStyle.spinRetain * getExtraDecayFactor(body.angularVelocity) * massFactor;
                    if (Math.abs(newAngVel) < FINAL_ZERO_THRESHOLD) {
                        newAngVel = 0;
                        body.isActiveTop = false; // 鐩存帴鏍囪涓哄仠姝㈡棆杞?
                    }
                    Body.setAngularVelocity(body, newAngVel);
                    // 骞崇Щ閫熷害琛板噺锛岃浆閫熶负0鏃剁珛鍗冲綊闆?
                    let spinRatio = Math.min(1, Math.abs(body.angularVelocity) / (body.customStyle.initialSpin || 1));
                    let spinLinearFactorPerSecond = Math.pow(spinRatio, SPIN_LINEAR_COUPLING_POWER);
                    let spinLinearFactorPerFrame = Math.pow(spinLinearFactorPerSecond, 1 / 60);
                    Body.setVelocity(body, {
                        x: body.velocity.x * LINEAR_DRAG * spinLinearFactorPerFrame,
                        y: body.velocity.y * LINEAR_DRAG * spinLinearFactorPerFrame
                    });
                });
                // 鑳滆礋鍒ゅ畾锛氭牳蹇冪鍧楁槸鍚﹀畬鍏ㄥ仠杞?
                if (activeBodies.length > 0 && (Date.now() - roundStartTime > 1500)) {
                    let redCoreAlive = trackedBody.red && trackedBody.red.isActiveTop;
                    let blueCoreAlive = trackedBody.blue && trackedBody.blue.isActiveTop;
                    if (!redCoreAlive || !blueCoreAlive) {
                        gameState = 'ROUND_OVER';
                        btnNextRound.disabled = false;
                        if (currentRound >= redName.length) {
                            btnNextRound.textContent = '鏌ョ湅鏈€缁堢粨绠?;
                        } else {
                            btnNextRound.textContent = `寮€濮嬬 ${currentRound + 1} 鍥炲悎`;
                        }
                        if (redCoreAlive && !blueCoreAlive) {
                            score.red++;
                            statusEl.textContent = `鏈洖鍚堬細绾㈡柟銆愯儨銆戯紙钃濇柟鏍稿績纰庡潡鍏堝畬鍏ㄥ仠杞級`;
                            celebrateRoundWinner('red');
                        } else if (blueCoreAlive && !redCoreAlive) {
                            score.blue++;
                            statusEl.textContent = `鏈洖鍚堬細钃濇柟銆愯儨銆戯紙绾㈡柟鏍稿績纰庡潡鍏堝畬鍏ㄥ仠杞級`;
                            celebrateRoundWinner('blue');
                        } else {
                            statusEl.textContent = `鏈洖鍚堬細鍙屾柟鏍稿績纰庡潡鍚屾椂鍋滄锛屽钩灞€`;
                        }
                        updateScoreboard();
                    }
                }
            });

            Render.run(render);
            runner = Runner.create();
            Runner.run(runner, engine);
        }

        function skewedSplitRatio() {
            let u = Math.random();
            let arcsine = (1 - Math.cos(Math.PI * u)) / 2;
            if (arcsine < 0.5) {
                return 0.5 * Math.pow(arcsine * 2, SHATTER_EXTREME_POWER);
            } else {
                return 1 - 0.5 * Math.pow((1 - arcsine) * 2, SHATTER_EXTREME_POWER);
            }
        }  // TODO: 璁╃瑁傜殑褰㈢姸鏇翠笉瑙勫垯锛屽鍔犻殢鏈烘€?

        function shatterBody(body) {
            if (!body.isActiveTop) return;
            const half = BASE_SIZE / 2;
            const MIN_FRAG = 6;
            let rx = skewedSplitRatio();
            let ry = skewedSplitRatio();
            let pivotX = -half + rx * BASE_SIZE;
            let pivotY = -half + ry * BASE_SIZE;
            pivotX = Math.max(-half + MIN_FRAG, Math.min(half - MIN_FRAG, pivotX));
            pivotY = Math.max(-half + MIN_FRAG, Math.min(half - MIN_FRAG, pivotY));
            const rawFrags = [
                { w: pivotX - (-half), h: pivotY - (-half), ox: (-half + pivotX) / 2, oy: (-half + pivotY) / 2 },
                { w: half - pivotX, h: pivotY - (-half), ox: (pivotX + half) / 2, oy: (-half + pivotY) / 2 },
                { w: pivotX - (-half), h: half - pivotY, ox: (-half + pivotX) / 2, oy: (pivotY + half) / 2 },
                { w: half - pivotX, h: half - pivotY, ox: (pivotX + half) / 2, oy: (pivotY + half) / 2 }
            ];
            let maxArea = -1,
                maxIndex = 0;
            rawFrags.forEach((f, i) => {
                let area = f.w * f.h;
                if (area > maxArea) { maxArea = area;
                    maxIndex = i; }
            });
            let avgArea = (BASE_SIZE * BASE_SIZE) / 4;
            let coreMass = body.density * maxArea;
            let frags = [];
            let cos = Math.cos(body.angle),
                sin = Math.sin(body.angle);
            rawFrags.forEach((f, i) => {
                let worldX = body.position.x + f.ox * cos - f.oy * sin;
                let worldY = body.position.y + f.ox * sin + f.oy * cos;
                let frag = Bodies.rectangle(worldX, worldY, f.w, f.h, {
                    restitution: 0.18,
                    friction: 0.04,
                    frictionAir: 0.006,
                    density: body.density,
                    angle: body.angle,
                    render: { visible: false }
                });
                frag.isActiveTop = true;
                frag.isTopPart = true;
                frag.isFragment = true;
                frag.isLargest = (i === maxIndex);
                let sizeRatio = (f.w * f.h) / avgArea;
                let fragCoreMass = body.density * f.w * f.h;
                frag.customStyle = {
                    ...body.customStyle,
                    offsetX: f.ox,
                    offsetY: f.oy,
                    fragW: f.w,
                    fragH: f.h,
                    coreMass: fragCoreMass,
                    spinRetain: body.customStyle.spinRetain * (0.92 + 0.08 * Math.min(1, sizeRatio))
                };
                let explodeGain = 1 / Math.max(0.25, sizeRatio);
                explodeGain = Math.min(explodeGain, 3);
                Body.setVelocity(frag, {
                    x: body.velocity.x + f.ox * cos * 0.04 * explodeGain,
                    y: body.velocity.y + f.oy * cos * 0.04 * explodeGain
                });
                if (frag.isLargest) {
                    Body.setAngularVelocity(frag, body.angularVelocity * 0.96 + (Math.random() - 0.5) * 0.15);
                } else {
                    let inertiaFactor = Math.max(0.78, Math.min(1, sizeRatio));
                    Body.setAngularVelocity(frag, body.angularVelocity * inertiaFactor + (Math.random() - 0.5) * 0.25);
                }
                frags.push(frag);
            });
            if (trackedBody[body.customStyle.team] === body) {
                trackedBody[body.customStyle.team] = frags[maxIndex];
                trackedBody[body.customStyle.team].customStyle.coreMass = coreMass;
            }
            Composite.remove(engine.world, body);
            activeBodies = activeBodies.filter(b => b !== body);
            Composite.add(engine.world, frags);
            activeBodies.push(...frags);
        }

        function spawnTops(rChar, bChar, rMass, bMass) {
            activeBodies.forEach(b => Composite.remove(engine.world, b));
            activeBodies = [];
            sparks = [];
            let rDensity = 0.08 * (rMass / 1200);
            let bDensity = 0.08 * (bMass / 1200);
            let rRetain = Math.min(0.9998, 0.993 + (rMass / 3000) * 0.004);
            let bRetain = Math.min(0.9998, 0.993 + (bMass / 3000) * 0.004);
            const buildOptions = (density) => ({
                restitution: 0.12,
                friction: 0.04,
                frictionAir: 0.001,
                density: density,
                render: { visible: false }
            });
            let redInitialSpin = INITIAL_SPIN_BASE + Math.random() * INITIAL_SPIN_RANDOM;
            let blueInitialSpin = INITIAL_SPIN_BASE + Math.random() * INITIAL_SPIN_RANDOM;
            let redBody = Bodies.rectangle(cx - 150, cy, BASE_SIZE, BASE_SIZE, buildOptions(rDensity));
            redBody.isActiveTop = true;
            redBody.isTopPart = true;
            redBody.isFragment = false;
            redBody.isLargest = true;
            redBody.customStyle = { char: rChar, team: 'red', faceColor: '#a9352e', depthColor: '#7a231e', spinRetain: rRetain,
                initialSpin: redInitialSpin, coreMass: rDensity * BASE_SIZE * BASE_SIZE };
            Body.setAngularVelocity(redBody, redInitialSpin);
            Body.setVelocity(redBody, { x: 1.2, y: (Math.random() - 0.5) * 0.8 });
            let blueBody = Bodies.rectangle(cx + 150, cy, BASE_SIZE, BASE_SIZE, buildOptions(bDensity));
            blueBody.isActiveTop = true;
            blueBody.isTopPart = true;
            blueBody.isFragment = false;
            blueBody.isLargest = true;
            blueBody.customStyle = { char: bChar, team: 'blue', faceColor: '#285777', depthColor: '#17364c',
                spinRetain: bRetain, initialSpin: blueInitialSpin, coreMass: bDensity * BASE_SIZE * BASE_SIZE };
            Body.setAngularVelocity(blueBody, -blueInitialSpin);
            Body.setVelocity(blueBody, { x: -1.2, y: (Math.random() - 0.5) * 0.8 });
            trackedBody.red = redBody;
            trackedBody.blue = blueBody;
            activeBodies.push(redBody, blueBody);
            Composite.add(engine.world, activeBodies);
        }
    
