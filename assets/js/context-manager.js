/**
 * Context Manager - 대화 맥락 복기 시스템
 * localStorage 기반 대화 기록 관리 및 컨텍스트 브리프 생성
 */
const ContextManager = {
    STORAGE_KEY: 'eulpeul_context_entries',
    entries: [],

    init() {
        this.loadEntries();
        this.bindNavigation();
        this.bindForm();
        this.bindSearch();
        this.bindBrief();
        this.bindDataManage();
        this.bindModal();
        this.bindFilters();
        this.setDefaultDate();
        this.renderTimeline();
        this.updateEntryCount();
        this.populateTagFilters();
    },

    // ===== 데이터 영속성 =====
    loadEntries() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            this.entries = raw ? JSON.parse(raw) : [];
        } catch {
            this.entries = [];
        }
    },

    saveEntries() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.entries));
        this.updateEntryCount();
        this.populateTagFilters();
    },

    // ===== 네비게이션 =====
    bindNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
                document.getElementById(`view-${view}`).classList.add('active');
            });
        });

        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
        }
    },

    // ===== 폼 처리 =====
    bindForm() {
        const form = document.getElementById('entryForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEntry();
        });

        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.resetForm();
        });
    },

    setDefaultDate() {
        const dateInput = document.getElementById('entryDate');
        dateInput.value = new Date().toISOString().split('T')[0];
    },

    saveEntry() {
        const editId = document.getElementById('editId').value;
        const entry = {
            id: editId ? editId : Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            title: document.getElementById('entryTitle').value.trim(),
            date: document.getElementById('entryDate').value || new Date().toISOString().split('T')[0],
            summary: document.getElementById('entrySummary').value.trim(),
            decisions: this.textToList(document.getElementById('entryDecisions').value),
            actions: this.textToList(document.getElementById('entryActions').value),
            codeRefs: this.textToList(document.getElementById('entryCodeRefs').value),
            tags: document.getElementById('entryTags').value.split(',').map(t => t.trim()).filter(Boolean),
            priority: document.getElementById('entryPriority').value,
            notes: document.getElementById('entryNotes').value.trim(),
            updatedAt: new Date().toISOString()
        };

        if (editId) {
            const idx = this.entries.findIndex(e => e.id === editId);
            if (idx !== -1) {
                entry.createdAt = this.entries[idx].createdAt;
                this.entries[idx] = entry;
            }
            this.showToast('기록이 수정되었습니다.');
        } else {
            entry.createdAt = new Date().toISOString();
            this.entries.push(entry);
            this.showToast('새 기록이 저장되었습니다.');
        }

        this.saveEntries();
        this.resetForm();
        this.renderTimeline();

        // 타임라인 뷰로 전환
        document.querySelector('[data-view="timeline"]').click();
    },

    resetForm() {
        document.getElementById('entryForm').reset();
        document.getElementById('editId').value = '';
        document.getElementById('formTitle').textContent = '새 대화 맥락 기록';
        document.getElementById('submitBtn').textContent = '기록 저장';
        document.getElementById('cancelEdit').style.display = 'none';
        this.setDefaultDate();
    },

    loadEntryToForm(entry) {
        document.getElementById('editId').value = entry.id;
        document.getElementById('entryTitle').value = entry.title;
        document.getElementById('entryDate').value = entry.date;
        document.getElementById('entrySummary').value = entry.summary;
        document.getElementById('entryDecisions').value = (entry.decisions || []).join('\n');
        document.getElementById('entryActions').value = (entry.actions || []).join('\n');
        document.getElementById('entryCodeRefs').value = (entry.codeRefs || []).join('\n');
        document.getElementById('entryTags').value = (entry.tags || []).join(', ');
        document.getElementById('entryPriority').value = entry.priority || 'medium';
        document.getElementById('entryNotes').value = entry.notes || '';
        document.getElementById('formTitle').textContent = '기록 수정';
        document.getElementById('submitBtn').textContent = '수정 저장';
        document.getElementById('cancelEdit').style.display = 'inline-block';

        document.querySelector('[data-view="new-entry"]').click();
    },

    // ===== 타임라인 렌더링 =====
    bindFilters() {
        ['filterTag', 'filterPriority', 'sortOrder'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.renderTimeline());
        });
    },

    renderTimeline() {
        const container = document.getElementById('timelineContainer');
        let entries = [...this.entries];

        // 필터 적용
        const tagFilter = document.getElementById('filterTag').value;
        const priorityFilter = document.getElementById('filterPriority').value;
        const sortOrder = document.getElementById('sortOrder').value;

        if (tagFilter) {
            entries = entries.filter(e => (e.tags || []).includes(tagFilter));
        }
        if (priorityFilter) {
            entries = entries.filter(e => e.priority === priorityFilter);
        }

        // 정렬
        entries.sort((a, b) => {
            const da = new Date(a.date), db = new Date(b.date);
            return sortOrder === 'newest' ? db - da : da - db;
        });

        if (entries.length === 0) {
            container.innerHTML = '<p class="empty-state">표시할 기록이 없습니다.</p>';
            return;
        }

        // 날짜별 그룹핑
        const groups = {};
        entries.forEach(entry => {
            const dateKey = entry.date;
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(entry);
        });

        let html = '';
        Object.keys(groups).forEach(dateKey => {
            const dateLabel = this.formatDate(dateKey);
            html += `<div class="timeline-date-group">
                <div class="timeline-date-label">${dateLabel}</div>`;
            groups[dateKey].forEach(entry => {
                html += this.renderTimelineCard(entry);
            });
            html += '</div>';
        });

        container.innerHTML = html;

        // 카드 클릭 이벤트
        container.querySelectorAll('.timeline-card').forEach(card => {
            card.addEventListener('click', () => {
                const entry = this.entries.find(e => e.id === card.dataset.id);
                if (entry) this.showDetail(entry);
            });
        });
    },

    renderTimelineCard(entry) {
        const priorityClass = `priority-${entry.priority || 'medium'}`;
        const tags = (entry.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
        const decisionCount = (entry.decisions || []).length;
        const actionCount = (entry.actions || []).length;

        return `<div class="timeline-card ${priorityClass}" data-id="${entry.id}">
            <div class="card-priority-bar"></div>
            <div class="card-content">
                <h3 class="card-title">${this.escapeHtml(entry.title)}</h3>
                <p class="card-summary">${this.escapeHtml(this.truncate(entry.summary, 120))}</p>
                <div class="card-meta">
                    ${tags ? `<div class="card-tags">${tags}</div>` : ''}
                    <div class="card-stats">
                        ${decisionCount > 0 ? `<span class="stat">결정 ${decisionCount}</span>` : ''}
                        ${actionCount > 0 ? `<span class="stat">액션 ${actionCount}</span>` : ''}
                    </div>
                </div>
            </div>
        </div>`;
    },

    // ===== 검색 =====
    bindSearch() {
        const searchInput = document.getElementById('searchInput');
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => this.performSearch(searchInput.value), 200);
        });
    },

    performSearch(query) {
        const container = document.getElementById('searchResults');
        if (!query.trim()) {
            container.innerHTML = '<p class="empty-state">검색어를 입력하면 관련 기록을 찾아드립니다.</p>';
            return;
        }

        const q = query.toLowerCase();
        const results = this.entries.filter(e => {
            return e.title.toLowerCase().includes(q)
                || e.summary.toLowerCase().includes(q)
                || (e.decisions || []).some(d => d.toLowerCase().includes(q))
                || (e.actions || []).some(a => a.toLowerCase().includes(q))
                || (e.tags || []).some(t => t.toLowerCase().includes(q))
                || (e.notes || '').toLowerCase().includes(q)
                || (e.codeRefs || []).some(c => c.toLowerCase().includes(q));
        });

        if (results.length === 0) {
            container.innerHTML = `<p class="empty-state">"${this.escapeHtml(query)}"에 대한 결과가 없습니다.</p>`;
            return;
        }

        let html = `<p class="result-count">${results.length}개의 결과</p>`;
        results.forEach(entry => {
            html += this.renderTimelineCard(entry);
        });
        container.innerHTML = html;

        container.querySelectorAll('.timeline-card').forEach(card => {
            card.addEventListener('click', () => {
                const entry = this.entries.find(e => e.id === card.dataset.id);
                if (entry) this.showDetail(entry);
            });
        });
    },

    // ===== 컨텍스트 브리프 생성 =====
    bindBrief() {
        document.getElementById('generateBrief').addEventListener('click', () => this.generateBrief());
        document.getElementById('copyBrief').addEventListener('click', () => this.copyBrief());
    },

    generateBrief() {
        const range = document.getElementById('briefRange').value;
        const tagFilter = document.getElementById('briefTag').value;
        const priorityFilter = document.getElementById('briefPriority').value;
        const includeDecisions = document.getElementById('briefIncludeDecisions').checked;
        const includeActions = document.getElementById('briefIncludeActions').checked;
        const includeCode = document.getElementById('briefIncludeCode').checked;

        let entries = [...this.entries];

        // 기간 필터
        if (range !== 'all') {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - parseInt(range));
            entries = entries.filter(e => new Date(e.date) >= cutoff);
        }

        // 태그 필터
        if (tagFilter) {
            entries = entries.filter(e => (e.tags || []).includes(tagFilter));
        }

        // 중요도 필터
        if (priorityFilter === 'high') {
            entries = entries.filter(e => e.priority === 'high');
        } else if (priorityFilter === 'medium') {
            entries = entries.filter(e => e.priority === 'high' || e.priority === 'medium');
        }

        // 날짜 정렬 (오래된순)
        entries.sort((a, b) => new Date(a.date) - new Date(b.date));

        if (entries.length === 0) {
            this.showToast('해당 조건에 맞는 기록이 없습니다.', 'warning');
            return;
        }

        // 브리프 텍스트 생성
        let brief = `# 대화 맥락 브리프\n`;
        brief += `생성일: ${new Date().toLocaleDateString('ko-KR')}\n`;
        brief += `포함 기록: ${entries.length}건\n\n`;
        brief += `---\n\n`;
        brief += `아래는 이전 대화에서 논의된 내용의 요약입니다. 이 맥락을 참고하여 대화를 이어주세요.\n\n`;

        entries.forEach((entry, i) => {
            brief += `## ${i + 1}. ${entry.title} (${entry.date})\n\n`;
            brief += `**요약:** ${entry.summary}\n\n`;

            if (includeDecisions && entry.decisions && entry.decisions.length > 0) {
                brief += `**핵심 결정사항:**\n`;
                entry.decisions.forEach(d => { brief += `- ${d}\n`; });
                brief += '\n';
            }

            if (includeActions && entry.actions && entry.actions.length > 0) {
                brief += `**액션 아이템:**\n`;
                entry.actions.forEach(a => { brief += `- [ ] ${a}\n`; });
                brief += '\n';
            }

            if (includeCode && entry.codeRefs && entry.codeRefs.length > 0) {
                brief += `**관련 코드/파일:**\n`;
                entry.codeRefs.forEach(c => { brief += `- \`${c}\`\n`; });
                brief += '\n';
            }

            if (entry.notes) {
                brief += `**메모:** ${entry.notes}\n\n`;
            }

            brief += `---\n\n`;
        });

        brief += `위 맥락을 바탕으로 대화를 이어가 주세요.\n`;

        document.getElementById('briefOutput').textContent = brief;
        document.getElementById('briefOutputContainer').style.display = 'block';
    },

    copyBrief() {
        const text = document.getElementById('briefOutput').textContent;
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('클립보드에 복사되었습니다!');
        }).catch(() => {
            // 폴백: textarea 방식
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            this.showToast('클립보드에 복사되었습니다!');
        });
    },

    // ===== Import/Export =====
    bindDataManage() {
        document.getElementById('exportData').addEventListener('click', () => this.exportJSON());
        document.getElementById('importData').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });
        document.getElementById('importFile').addEventListener('change', (e) => this.importJSON(e));
        document.getElementById('clearAll').addEventListener('click', () => this.clearAllData());
        document.getElementById('exportClaudeMd').addEventListener('click', () => this.exportClaudeMd());
    },

    exportJSON() {
        const data = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            entries: this.entries
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this.downloadBlob(blob, `context-backup-${new Date().toISOString().slice(0, 10)}.json`);
        this.showToast('JSON 파일로 내보내기 완료!');
    },

    importJSON(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                const importEntries = data.entries || data;
                if (!Array.isArray(importEntries)) throw new Error('Invalid format');

                const existingIds = new Set(this.entries.map(e => e.id));
                let added = 0;
                importEntries.forEach(entry => {
                    if (!existingIds.has(entry.id)) {
                        this.entries.push(entry);
                        added++;
                    }
                });

                this.saveEntries();
                this.renderTimeline();
                document.getElementById('importStatus').textContent = `${added}개의 새 기록을 가져왔습니다.`;
                this.showToast(`${added}개 기록 가져오기 완료!`);
            } catch {
                document.getElementById('importStatus').textContent = '파일 형식이 올바르지 않습니다.';
                this.showToast('가져오기 실패: 올바른 JSON 파일인지 확인하세요.', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    },

    clearAllData() {
        if (!confirm('정말로 모든 기록을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
        if (!confirm('한 번 더 확인합니다. 모든 대화 기록이 영구 삭제됩니다.')) return;
        this.entries = [];
        this.saveEntries();
        this.renderTimeline();
        this.showToast('모든 기록이 삭제되었습니다.');
    },

    exportClaudeMd() {
        const entries = [...this.entries].sort((a, b) => new Date(b.date) - new Date(a.date));
        if (entries.length === 0) {
            this.showToast('내보낼 기록이 없습니다.', 'warning');
            return;
        }

        let md = `# CLAUDE.md - 프로젝트 대화 맥락\n\n`;
        md += `> 이 파일은 이전 대화에서 논의된 내용을 정리한 것입니다.\n`;
        md += `> 마지막 업데이트: ${new Date().toLocaleDateString('ko-KR')}\n\n`;

        // 최근 핵심 결정사항 모아서
        const allDecisions = [];
        const allActions = [];
        entries.forEach(entry => {
            (entry.decisions || []).forEach(d => allDecisions.push({ text: d, date: entry.date, title: entry.title }));
            (entry.actions || []).forEach(a => allActions.push({ text: a, date: entry.date, title: entry.title }));
        });

        if (allDecisions.length > 0) {
            md += `## 핵심 결정사항\n\n`;
            allDecisions.slice(0, 20).forEach(d => {
                md += `- ${d.text} _(${d.date}, ${d.title})_\n`;
            });
            md += '\n';
        }

        if (allActions.length > 0) {
            md += `## 미완료 액션 아이템\n\n`;
            allActions.slice(0, 15).forEach(a => {
                md += `- [ ] ${a.text} _(${a.date})_\n`;
            });
            md += '\n';
        }

        md += `## 대화 기록 요약\n\n`;
        entries.slice(0, 30).forEach(entry => {
            md += `### ${entry.title} (${entry.date})\n`;
            md += `${entry.summary}\n\n`;
        });

        const blob = new Blob([md], { type: 'text/markdown' });
        this.downloadBlob(blob, 'CLAUDE.md');
        this.showToast('CLAUDE.md 파일 다운로드 완료!');
    },

    // ===== 상세보기 모달 =====
    bindModal() {
        document.getElementById('modalClose').addEventListener('click', () => this.hideModal());
        document.getElementById('detailModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('detailModal')) this.hideModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hideModal();
        });
    },

    showDetail(entry) {
        this.currentDetailEntry = entry;
        document.getElementById('modalTitle').textContent = entry.title;

        let html = `<div class="detail-section">
            <span class="detail-date">${this.formatDate(entry.date)}</span>
            <span class="detail-priority priority-badge-${entry.priority || 'medium'}">${this.priorityLabel(entry.priority)}</span>
        </div>`;

        html += `<div class="detail-section">
            <h4>요약</h4>
            <p>${this.escapeHtml(entry.summary)}</p>
        </div>`;

        if (entry.decisions && entry.decisions.length > 0) {
            html += `<div class="detail-section">
                <h4>핵심 결정사항</h4>
                <ul>${entry.decisions.map(d => `<li>${this.escapeHtml(d)}</li>`).join('')}</ul>
            </div>`;
        }

        if (entry.actions && entry.actions.length > 0) {
            html += `<div class="detail-section">
                <h4>액션 아이템</h4>
                <ul>${entry.actions.map(a => `<li>${this.escapeHtml(a)}</li>`).join('')}</ul>
            </div>`;
        }

        if (entry.codeRefs && entry.codeRefs.length > 0) {
            html += `<div class="detail-section">
                <h4>코드/파일 참조</h4>
                <ul class="code-refs">${entry.codeRefs.map(c => `<li><code>${this.escapeHtml(c)}</code></li>`).join('')}</ul>
            </div>`;
        }

        if (entry.tags && entry.tags.length > 0) {
            html += `<div class="detail-section">
                <h4>태그</h4>
                <div class="card-tags">${entry.tags.map(t => `<span class="tag">${this.escapeHtml(t)}</span>`).join('')}</div>
            </div>`;
        }

        if (entry.notes) {
            html += `<div class="detail-section">
                <h4>추가 메모</h4>
                <p>${this.escapeHtml(entry.notes)}</p>
            </div>`;
        }

        document.getElementById('modalBody').innerHTML = html;

        // 수정/삭제 버튼 이벤트
        document.getElementById('modalEdit').onclick = () => {
            this.hideModal();
            this.loadEntryToForm(entry);
        };
        document.getElementById('modalDelete').onclick = () => {
            if (confirm('이 기록을 삭제하시겠습니까?')) {
                this.entries = this.entries.filter(e => e.id !== entry.id);
                this.saveEntries();
                this.renderTimeline();
                this.hideModal();
                this.showToast('기록이 삭제되었습니다.');
            }
        };

        document.getElementById('detailModal').classList.add('active');
    },

    hideModal() {
        document.getElementById('detailModal').classList.remove('active');
    },

    // ===== 유틸리티 =====
    textToList(text) {
        return text.split('\n').map(line => line.trim()).filter(Boolean);
    },

    truncate(text, max) {
        return text.length > max ? text.slice(0, max) + '...' : text;
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
        return d.toLocaleDateString('ko-KR', options);
    },

    priorityLabel(p) {
        return { high: '높음', medium: '보통', low: '낮음' }[p] || '보통';
    },

    updateEntryCount() {
        document.getElementById('entryCount').textContent = `${this.entries.length}개 기록`;
    },

    populateTagFilters() {
        const allTags = new Set();
        this.entries.forEach(e => (e.tags || []).forEach(t => allTags.add(t)));
        const sorted = [...allTags].sort();

        ['filterTag', 'briefTag'].forEach(selectId => {
            const sel = document.getElementById(selectId);
            if (!sel) return;
            const currentVal = sel.value;
            const firstOption = sel.options[0];
            sel.innerHTML = '';
            sel.appendChild(firstOption);
            sorted.forEach(tag => {
                const opt = document.createElement('option');
                opt.value = tag;
                opt.textContent = tag;
                sel.appendChild(opt);
            });
            sel.value = currentVal;
        });
    },

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => ContextManager.init());
