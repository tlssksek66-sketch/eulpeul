/**
 * ChartEngine - Canvas 기반 경량 차트 라이브러리 (매거진 전용)
 * 외부 의존성 없이 순수 Canvas API로 렌더링.
 */
const ChartEngine = {
    colors: {
        blue: '#4a7cff',
        green: '#34d399',
        purple: '#a78bfa',
        orange: '#fb923c',
        red: '#f87171',
        yellow: '#fbbf24',
        cyan: '#22d3ee',
        gray: '#6b7280',
        grid: '#252836',
        text: '#9aa0b4',
        textLight: '#5a5f73',
        bg: '#13151f'
    },

    /**
     * 캔버스 초기화 + DPI 보정
     */
    initCanvas(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.clearRect(0, 0, rect.width, rect.height);

        return { canvas, ctx, width: rect.width, height: rect.height };
    },

    /**
     * 일별 클리핑 추이 (막대 차트, 값 라벨 표시)
     */
    dailyBarChart(canvasId, { labels, counts, color = '#4a7cff' }) {
        const c = this.initCanvas(canvasId);
        if (!c) return;
        const { ctx, width, height } = c;
        const padding = { top: 30, right: 16, bottom: 32, left: 16 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        const maxVal = Math.max(1, ...counts) * 1.2;
        const slot = chartW / counts.length;
        const barW = Math.min(slot * 0.55, 36);

        counts.forEach((v, i) => {
            const x = padding.left + i * slot + (slot - barW) / 2;
            const h = (v / maxVal) * chartH;
            const y = padding.top + chartH - h;

            // 막대
            if (v > 0) {
                const grad = ctx.createLinearGradient(0, y, 0, padding.top + chartH);
                grad.addColorStop(0, color);
                grad.addColorStop(1, color + '55');
                ctx.fillStyle = grad;
                this._roundRectTop(ctx, x, y, barW, h, 4);
                ctx.fill();

                // 값 라벨
                ctx.fillStyle = color;
                ctx.font = 'bold 11px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(String(v), x + barW / 2, y - 6);
            }

            // 날짜 라벨
            ctx.fillStyle = this.colors.textLight;
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(labels[i], x + barW / 2, height - 12);
        });
    },

    /**
     * 도넛 차트 (중앙 합계 + 우측 범례)
     */
    donutWithCenter(canvasId, { items, centerLabel = '건', centerSize = 'lg' }) {
        const c = this.initCanvas(canvasId);
        if (!c) return;
        const { ctx, width, height } = c;
        const total = items.reduce((s, x) => s + x.value, 0);
        if (total === 0) return;

        const cx = Math.min(width * 0.32, height * 0.6);
        const cy = height / 2;
        const r = Math.min(cx, cy) - 16;
        const inner = r * 0.62;

        let start = -Math.PI / 2;
        items.forEach(it => {
            const ang = (it.value / total) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, r, start, start + ang);
            ctx.arc(cx, cy, inner, start + ang, start, true);
            ctx.closePath();
            ctx.fillStyle = it.color;
            ctx.fill();
            start += ang;
        });

        // 중앙 합계
        ctx.fillStyle = '#f4f5fb';
        ctx.font = `bold ${centerSize === 'lg' ? '26' : '20'}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(total), cx, cy - 6);
        ctx.font = '11px Noto Sans KR, sans-serif';
        ctx.fillStyle = this.colors.text;
        ctx.fillText(centerLabel, cx, cy + 14);

        // 우측 범례
        const legendX = cx + r + 24;
        const lineH = 22;
        const legendY = cy - (items.length * lineH) / 2 + lineH / 2;
        items.forEach((it, i) => {
            const y = legendY + i * lineH;
            ctx.fillStyle = it.color;
            this._roundRect(ctx, legendX, y - 6, 10, 10, 2);
            ctx.fill();
            ctx.fillStyle = this.colors.text;
            ctx.font = '12px Noto Sans KR, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(it.label, legendX + 18, y);
            ctx.fillStyle = '#f4f5fb';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(String(it.value), width - 16, y);
        });
    },

    /**
     * 가로 스택 감성바 (긍정/중립/부정)
     */
    stackedSentimentBar(canvasId, { items }) {
        const c = this.initCanvas(canvasId);
        if (!c) return;
        const { ctx, width, height } = c;
        const total = items.reduce((s, x) => s + x.value, 0);
        if (total === 0) return;

        const barH = 16;
        const barY = 18;
        const barW = width - 32;
        const barX = 16;
        const r = 8;

        // 배경
        ctx.fillStyle = '#1c1f2e';
        this._roundRect(ctx, barX, barY, barW, barH, r);
        ctx.fill();

        // 스택
        let cursor = barX;
        items.forEach((it, i) => {
            const w = (it.value / total) * barW;
            ctx.fillStyle = it.color;
            // 양 끝만 둥글게
            const isFirst = i === 0;
            const isLast = i === items.length - 1;
            ctx.save();
            ctx.beginPath();
            this._roundRect(ctx, barX, barY, barW, barH, r);
            ctx.clip();
            ctx.fillRect(cursor, barY, w, barH);
            ctx.restore();
            cursor += w;
        });

        // 범례
        const lineY = barY + barH + 24;
        const colW = barW / items.length;
        items.forEach((it, i) => {
            const x = barX + colW * i;
            ctx.fillStyle = it.color;
            this._roundRect(ctx, x, lineY - 8, 9, 9, 2);
            ctx.fill();
            ctx.fillStyle = this.colors.text;
            ctx.font = '12px Noto Sans KR, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(it.label, x + 14, lineY - 4);
            ctx.fillStyle = '#f4f5fb';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.fillText(`${it.value}  (${it.pct}%)`, x + 14, lineY + 12);
        });
    },

    /**
     * 가로 막대 (Top N — 매체/키워드)
     */
    horizontalBarChart(canvasId, { items, color = '#34d399' }) {
        const c = this.initCanvas(canvasId);
        if (!c) return;
        const { ctx, width, height } = c;
        const padTop = 8, padBottom = 8, padRight = 36, labelW = 180;
        const max = Math.max(...items.map(x => x.value), 1);
        const rowH = (height - padTop - padBottom) / items.length;

        items.forEach((it, i) => {
            const y = padTop + i * rowH + rowH / 2;
            // 라벨
            ctx.fillStyle = this.colors.text;
            ctx.font = '12px Noto Sans KR, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const label = it.label.length > 18 ? it.label.slice(0, 18) + '…' : it.label;
            ctx.fillText(label, 8, y);

            // 막대
            const barX = labelW;
            const barMax = width - labelW - padRight;
            const barW = (it.value / max) * barMax;
            const barH = Math.max(8, rowH * 0.5);
            const grad = ctx.createLinearGradient(barX, y, barX + barW, y);
            grad.addColorStop(0, color + 'aa');
            grad.addColorStop(1, color);
            ctx.fillStyle = grad;
            this._roundRect(ctx, barX, y - barH / 2, barW, barH, barH / 2);
            ctx.fill();

            // 값
            ctx.fillStyle = '#f4f5fb';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(String(it.value), barX + barW + 8, y);
        });
    },

    /**
     * 라운드 사각형 헬퍼
     */
    _roundRect(ctx, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.lineTo(x + w - rr, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
        ctx.lineTo(x + w, y + h - rr);
        ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
        ctx.lineTo(x + rr, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
        ctx.lineTo(x, y + rr);
        ctx.quadraticCurveTo(x, y, x + rr, y);
        ctx.closePath();
    },

    _roundRectTop(ctx, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.lineTo(x + w - rr, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x, y + rr);
        ctx.quadraticCurveTo(x, y, x + rr, y);
        ctx.closePath();
    }
};
