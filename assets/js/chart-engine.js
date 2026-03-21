/**
 * ChartEngine - Canvas 기반 경량 차트 라이브러리
 * 외부 의존성 없이 순수 Canvas API로 차트 렌더링
 */
const ChartEngine = {
    colors: {
        blue: '#4a7cff',
        blueLight: '#6b99ff',
        green: '#34d399',
        red: '#f87171',
        yellow: '#fbbf24',
        purple: '#a78bfa',
        cyan: '#22d3ee',
        orange: '#fb923c',
        grid: '#2a2e3f',
        text: '#8b90a0',
        textLight: '#5a5f73',
        bg: '#1e2132'
    },

    palette: ['#4a7cff', '#34d399', '#a78bfa', '#fbbf24', '#fb923c', '#22d3ee', '#f87171', '#6b99ff'],

    /**
     * 캔버스 초기화 & DPI 보정
     */
    initCanvas(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';

        return { canvas, ctx, width: rect.width, height: rect.height };
    },

    /**
     * 라인 차트
     */
    lineChart(canvasId, config) {
        const c = this.initCanvas(canvasId);
        if (!c) return;
        const { ctx, width, height } = c;
        const { labels, datasets, showGrid = true, showDots = true } = config;
        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        // 최대값 계산
        let maxVal = 0;
        datasets.forEach(ds => {
            ds.data.forEach(v => { if (v > maxVal) maxVal = v; });
        });
        maxVal = Math.ceil(maxVal * 1.1);

        // 그리드 라인
        if (showGrid) {
            ctx.strokeStyle = this.colors.grid;
            ctx.lineWidth = 0.5;
            const gridLines = 5;
            for (let i = 0; i <= gridLines; i++) {
                const y = padding.top + (chartH / gridLines) * i;
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(width - padding.right, y);
                ctx.stroke();

                // Y축 레이블
                const val = maxVal - (maxVal / gridLines) * i;
                ctx.fillStyle = this.colors.textLight;
                ctx.font = '11px Inter, sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(this.formatNumber(val), padding.left - 8, y + 4);
            }
        }

        // X축 레이블
        ctx.fillStyle = this.colors.text;
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        const stepX = chartW / (labels.length - 1);
        labels.forEach((label, i) => {
            const x = padding.left + i * stepX;
            ctx.fillText(label, x, height - 10);
        });

        // 데이터셋 그리기
        datasets.forEach((ds, di) => {
            const color = ds.color || this.palette[di % this.palette.length];

            // 영역 채우기
            if (ds.fill) {
                ctx.beginPath();
                ctx.moveTo(padding.left, padding.top + chartH);
                ds.data.forEach((val, i) => {
                    const x = padding.left + i * stepX;
                    const y = padding.top + chartH - (val / maxVal) * chartH;
                    ctx.lineTo(x, y);
                });
                ctx.lineTo(padding.left + (ds.data.length - 1) * stepX, padding.top + chartH);
                ctx.closePath();
                const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
                grad.addColorStop(0, color + '30');
                grad.addColorStop(1, color + '05');
                ctx.fillStyle = grad;
                ctx.fill();
            }

            // 라인
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round';
            ds.data.forEach((val, i) => {
                const x = padding.left + i * stepX;
                const y = padding.top + chartH - (val / maxVal) * chartH;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // 점
            if (showDots) {
                ds.data.forEach((val, i) => {
                    const x = padding.left + i * stepX;
                    const y = padding.top + chartH - (val / maxVal) * chartH;
                    ctx.beginPath();
                    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(x, y, 2, 0, Math.PI * 2);
                    ctx.fillStyle = this.colors.bg;
                    ctx.fill();
                });
            }

            // 점선 (예측 데이터)
            if (ds.dashed) {
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.strokeStyle = color + '80';
                ctx.lineWidth = 2;
                ds.data.forEach((val, i) => {
                    const x = padding.left + i * stepX;
                    const y = padding.top + chartH - (val / maxVal) * chartH;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });

        // 범례
        if (datasets.length > 1) {
            let legendX = padding.left;
            datasets.forEach((ds, di) => {
                const color = ds.color || this.palette[di % this.palette.length];
                ctx.fillStyle = color;
                ctx.fillRect(legendX, 4, 12, 3);
                ctx.fillStyle = this.colors.text;
                ctx.font = '11px Inter, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(ds.label || '', legendX + 16, 10);
                legendX += ctx.measureText(ds.label || '').width + 36;
            });
        }
    },

    /**
     * 바 차트
     */
    barChart(canvasId, config) {
        const c = this.initCanvas(canvasId);
        if (!c) return;
        const { ctx, width, height } = c;
        const { labels, datasets, horizontal = false } = config;
        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        let maxVal = 0;
        datasets.forEach(ds => {
            ds.data.forEach(v => { if (v > maxVal) maxVal = v; });
        });
        maxVal = Math.ceil(maxVal * 1.15);

        // 그리드
        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = 0.5;
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartH / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            const val = maxVal - (maxVal / gridLines) * i;
            ctx.fillStyle = this.colors.textLight;
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(this.formatNumber(val), padding.left - 8, y + 4);
        }

        const groupWidth = chartW / labels.length;
        const barCount = datasets.length;
        const barWidth = Math.min((groupWidth * 0.7) / barCount, 40);
        const groupOffset = (groupWidth - barWidth * barCount) / 2;

        datasets.forEach((ds, di) => {
            const color = ds.color || this.palette[di % this.palette.length];
            ds.data.forEach((val, i) => {
                const x = padding.left + i * groupWidth + groupOffset + di * barWidth;
                const barH = (val / maxVal) * chartH;
                const y = padding.top + chartH - barH;

                // 바 그라데이션
                const grad = ctx.createLinearGradient(x, y, x, padding.top + chartH);
                grad.addColorStop(0, color);
                grad.addColorStop(1, color + '60');
                ctx.fillStyle = grad;

                // 둥근 모서리
                const r = 3;
                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.lineTo(x + barWidth - r, y);
                ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
                ctx.lineTo(x + barWidth, padding.top + chartH);
                ctx.lineTo(x, padding.top + chartH);
                ctx.lineTo(x, y + r);
                ctx.quadraticCurveTo(x, y, x + r, y);
                ctx.fill();
            });
        });

        // X축 레이블
        ctx.fillStyle = this.colors.text;
        ctx.font = '11px Noto Sans KR, sans-serif';
        ctx.textAlign = 'center';
        labels.forEach((label, i) => {
            const x = padding.left + i * groupWidth + groupWidth / 2;
            ctx.fillText(label, x, height - 10);
        });
    },

    /**
     * 도넛 차트
     */
    doughnutChart(canvasId, config) {
        const c = this.initCanvas(canvasId);
        if (!c) return;
        const { ctx, width, height } = c;
        const { labels, data, colors: customColors } = config;

        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(cx, cy) - 40;
        const innerRadius = radius * 0.6;
        const total = data.reduce((s, v) => s + v, 0);

        let startAngle = -Math.PI / 2;
        data.forEach((val, i) => {
            const angle = (val / total) * Math.PI * 2;
            const color = (customColors && customColors[i]) || this.palette[i % this.palette.length];

            ctx.beginPath();
            ctx.arc(cx, cy, radius, startAngle, startAngle + angle);
            ctx.arc(cx, cy, innerRadius, startAngle + angle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();

            // 레이블
            const midAngle = startAngle + angle / 2;
            const labelR = radius + 20;
            const lx = cx + Math.cos(midAngle) * labelR;
            const ly = cy + Math.sin(midAngle) * labelR;
            ctx.fillStyle = this.colors.text;
            ctx.font = '11px Noto Sans KR, sans-serif';
            ctx.textAlign = midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5 ? 'right' : 'left';
            ctx.fillText(`${labels[i]} ${Math.round(val / total * 100)}%`, lx, ly);

            startAngle += angle;
        });

        // 중앙 텍스트
        ctx.fillStyle = this.colors.text;
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('총 예산', cx, cy - 6);
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillStyle = this.colors.blueLight;
        ctx.fillText(this.formatCurrency(total), cx, cy + 16);
    },

    /**
     * 레이더 차트
     */
    radarChart(canvasId, config) {
        const c = this.initCanvas(canvasId);
        if (!c) return;
        const { ctx, width, height } = c;
        const { labels, datasets } = config;

        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(cx, cy) - 50;
        const sides = labels.length;
        const angleStep = (Math.PI * 2) / sides;

        // 배경 다각형
        for (let level = 5; level >= 1; level--) {
            const r = (radius / 5) * level;
            ctx.beginPath();
            for (let i = 0; i < sides; i++) {
                const angle = -Math.PI / 2 + i * angleStep;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.strokeStyle = this.colors.grid;
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        // 축선
        for (let i = 0; i < sides; i++) {
            const angle = -Math.PI / 2 + i * angleStep;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
            ctx.strokeStyle = this.colors.grid;
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // 레이블
            const lx = cx + Math.cos(angle) * (radius + 18);
            const ly = cy + Math.sin(angle) * (radius + 18);
            ctx.fillStyle = this.colors.text;
            ctx.font = '11px Noto Sans KR, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(labels[i], lx, ly);
        }

        // 데이터
        datasets.forEach((ds, di) => {
            const color = ds.color || this.palette[di];
            ctx.beginPath();
            ds.data.forEach((val, i) => {
                const angle = -Math.PI / 2 + i * angleStep;
                const r = (val / 100) * radius;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.fillStyle = color + '20';
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    },

    /**
     * 숫자 포맷팅
     */
    formatNumber(num) {
        if (num >= 100000000) return (num / 100000000).toFixed(1) + '억';
        if (num >= 10000) return (num / 10000).toFixed(0) + '만';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    },

    formatCurrency(num) {
        return '₩' + new Intl.NumberFormat('ko-KR').format(num);
    }
};
