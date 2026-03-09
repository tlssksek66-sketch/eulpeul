#!/usr/bin/env python3
"""
파일 관리자 - 웹 기반 원격 파일 관리 도구
브라우저에서 파일을 탐색, 정리, 이동, 삭제할 수 있습니다.

사용법:
    python3 file_manager.py                  # 현재 디렉토리, 포트 8000
    python3 file_manager.py --port 9000      # 포트 지정
    python3 file_manager.py --dir ~/Desktop  # 관리할 디렉토리 지정
    python3 file_manager.py --public         # 외부 접속 허용
"""

import http.server
import json
import os
import shutil
import urllib.parse
import argparse
import time

BASE_DIR = "."

CATEGORIES = {
    "이미지": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".ico", ".tiff", ".heic"],
    "문서": [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".hwp", ".hwpx", ".csv", ".rtf"],
    "동영상": [".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm", ".m4v"],
    "음악": [".mp3", ".wav", ".flac", ".aac", ".ogg", ".wma", ".m4a"],
    "압축파일": [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz"],
    "코드": [".py", ".js", ".ts", ".html", ".css", ".java", ".cpp", ".c", ".h", ".go", ".rs", ".rb", ".php", ".sh"],
}

CATEGORY_ICONS = {
    "이미지": "🖼️",
    "문서": "📄",
    "동영상": "🎬",
    "음악": "🎵",
    "압축파일": "📦",
    "코드": "💻",
    "기타": "📁",
}

EXT_TO_CATEGORY = {}
for cat, exts in CATEGORIES.items():
    for ext in exts:
        EXT_TO_CATEGORY[ext] = cat


def safe_path(requested_path):
    """경로 탐색 공격을 방지하고 BASE_DIR 내의 절대 경로를 반환합니다."""
    if not requested_path:
        return BASE_DIR
    joined = os.path.join(BASE_DIR, requested_path)
    real = os.path.realpath(joined)
    if not real.startswith(os.path.realpath(BASE_DIR)):
        return None
    return real


def format_size(size):
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024:
            return f"{size:.1f} {unit}" if unit != "B" else f"{size} {unit}"
        size /= 1024
    return f"{size:.1f} PB"


def unique_dest(dest_path):
    """이름 충돌 시 _1, _2 등을 추가합니다."""
    if not os.path.exists(dest_path):
        return dest_path
    base, ext = os.path.splitext(dest_path)
    counter = 1
    while os.path.exists(f"{base}_{counter}{ext}"):
        counter += 1
    return f"{base}_{counter}{ext}"


HTML_PAGE = r"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>파일 관리자</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
    background: #f0f2f5; color: #333; min-height: 100vh;
}
header {
    background: #1a73e8; color: white; padding: 16px 24px;
    display: flex; align-items: center; justify-content: space-between;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
header h1 { font-size: 20px; font-weight: 600; }
.breadcrumb {
    background: white; padding: 10px 24px; border-bottom: 1px solid #e0e0e0;
    display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
    font-size: 14px;
}
.breadcrumb a { color: #1a73e8; text-decoration: none; cursor: pointer; }
.breadcrumb a:hover { text-decoration: underline; }
.breadcrumb span.sep { color: #999; margin: 0 2px; }
.toolbar {
    padding: 12px 24px; display: flex; gap: 8px; flex-wrap: wrap;
    background: white; border-bottom: 1px solid #e0e0e0;
}
.btn {
    padding: 8px 16px; border: 1px solid #d0d0d0; border-radius: 6px;
    background: white; cursor: pointer; font-size: 13px;
    font-family: inherit; transition: all 0.15s;
    display: inline-flex; align-items: center; gap: 6px;
}
.btn:hover { background: #f5f5f5; border-color: #bbb; }
.btn-primary { background: #1a73e8; color: white; border-color: #1a73e8; }
.btn-primary:hover { background: #1557b0; }
.btn-danger { color: #d32f2f; border-color: #d32f2f; }
.btn-danger:hover { background: #fce4ec; }
main { padding: 16px 24px; }
.file-list {
    background: white; border-radius: 8px; overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.file-header {
    display: grid; grid-template-columns: 40px 1fr 100px 160px 80px;
    padding: 10px 16px; background: #fafafa; border-bottom: 2px solid #e0e0e0;
    font-size: 12px; font-weight: 600; color: #666; text-transform: uppercase;
}
.file-row {
    display: grid; grid-template-columns: 40px 1fr 100px 160px 80px;
    padding: 10px 16px; border-bottom: 1px solid #f0f0f0;
    align-items: center; cursor: pointer; transition: background 0.1s;
}
.file-row:hover { background: #f5f8ff; }
.file-row.selected { background: #e3f2fd; }
.file-icon { font-size: 20px; text-align: center; }
.file-name { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size, .file-date { font-size: 12px; color: #888; }
.file-actions { display: flex; gap: 4px; }
.file-actions button {
    padding: 4px 8px; border: none; background: none;
    cursor: pointer; border-radius: 4px; font-size: 14px;
}
.file-actions button:hover { background: #e0e0e0; }
.empty-state {
    text-align: center; padding: 60px 20px; color: #999;
}
.empty-state .icon { font-size: 48px; margin-bottom: 12px; }
footer {
    padding: 12px 24px; font-size: 12px; color: #888;
    display: flex; justify-content: space-between;
}
/* Modal */
.modal-overlay {
    display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.4); z-index: 100;
    justify-content: center; align-items: center;
}
.modal-overlay.active { display: flex; }
.modal {
    background: white; border-radius: 12px; padding: 24px;
    min-width: 360px; max-width: 90vw; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}
.modal h3 { margin-bottom: 16px; font-size: 16px; }
.modal input[type="text"] {
    width: 100%; padding: 10px 12px; border: 1px solid #d0d0d0;
    border-radius: 6px; font-size: 14px; font-family: inherit;
    margin-bottom: 16px;
}
.modal-buttons { display: flex; justify-content: flex-end; gap: 8px; }
/* Organize result */
.organize-result {
    margin-top: 12px; font-size: 14px; line-height: 1.8;
}
.organize-result .cat-item {
    display: flex; align-items: center; gap: 8px;
    padding: 4px 0;
}
/* Toast */
.toast {
    position: fixed; bottom: 24px; right: 24px; padding: 12px 20px;
    background: #333; color: white; border-radius: 8px; font-size: 14px;
    z-index: 200; opacity: 0; transition: opacity 0.3s;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.toast.show { opacity: 1; }
@media (max-width: 640px) {
    .file-header, .file-row {
        grid-template-columns: 32px 1fr 60px;
    }
    .file-date, .file-actions { display: none; }
    main { padding: 8px; }
    .toolbar { padding: 8px; }
}
</style>
</head>
<body>

<header>
    <h1>파일 관리자</h1>
    <span id="serverInfo" style="font-size:12px;opacity:0.8"></span>
</header>

<div class="breadcrumb" id="breadcrumb"></div>

<div class="toolbar">
    <button class="btn" onclick="goUp()">⬆️ 상위 폴더</button>
    <button class="btn" onclick="showNewFolderModal()">📁 새 폴더</button>
    <button class="btn btn-primary" onclick="organizeFiles()">✨ 자동 정리</button>
    <button class="btn" onclick="loadDirectory(currentPath)">🔄 새로고침</button>
</div>

<main>
    <div class="file-list">
        <div class="file-header">
            <div></div>
            <div>이름</div>
            <div>크기</div>
            <div>수정일</div>
            <div>작업</div>
        </div>
        <div id="fileListBody"></div>
    </div>
</main>

<footer>
    <span id="itemCount"></span>
    <span id="totalSize"></span>
</footer>

<!-- New Folder Modal -->
<div class="modal-overlay" id="newFolderModal">
    <div class="modal">
        <h3>새 폴더 만들기</h3>
        <input type="text" id="newFolderName" placeholder="폴더 이름을 입력하세요"
               onkeydown="if(event.key==='Enter')createFolder()">
        <div class="modal-buttons">
            <button class="btn" onclick="closeModal('newFolderModal')">취소</button>
            <button class="btn btn-primary" onclick="createFolder()">만들기</button>
        </div>
    </div>
</div>

<!-- Rename Modal -->
<div class="modal-overlay" id="renameModal">
    <div class="modal">
        <h3>이름 변경</h3>
        <input type="text" id="renameInput" placeholder="새 이름을 입력하세요"
               onkeydown="if(event.key==='Enter')doRename()">
        <div class="modal-buttons">
            <button class="btn" onclick="closeModal('renameModal')">취소</button>
            <button class="btn btn-primary" onclick="doRename()">변경</button>
        </div>
    </div>
</div>

<!-- Organize Result Modal -->
<div class="modal-overlay" id="organizeModal">
    <div class="modal">
        <h3>자동 정리 결과</h3>
        <div id="organizeResult" class="organize-result"></div>
        <div class="modal-buttons" style="margin-top:16px">
            <button class="btn btn-primary" onclick="closeModal('organizeModal');loadDirectory(currentPath)">확인</button>
        </div>
    </div>
</div>

<div class="toast" id="toast"></div>

<script>
let currentPath = "";
let renameTarget = "";

async function api(method, url, body) {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url);
    // For POST
    if (method === "POST") {
        const r = await fetch(url, opts);
        return r.json();
    }
    return res.json();
}

async function apiGet(url) {
    const res = await fetch(url);
    return res.json();
}

async function apiPost(url, body) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    return res.json();
}

function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2500);
}

function showModal(id) {
    document.getElementById(id).classList.add("active");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("active");
}

function getIcon(item) {
    if (item.is_dir) return "📁";
    const cat = item.category;
    const icons = {
        "이미지": "🖼️", "문서": "📄", "동영상": "🎬",
        "음악": "🎵", "압축파일": "📦", "코드": "💻", "기타": "📄"
    };
    return icons[cat] || "📄";
}

async function loadDirectory(path) {
    currentPath = path || "";
    try {
        const data = await apiGet("/api/list?path=" + encodeURIComponent(currentPath));
        if (data.error) { toast("오류: " + data.error); return; }
        renderBreadcrumb(data.path);
        renderFileList(data.items);
        document.getElementById("itemCount").textContent =
            `${data.items.length}개 항목`;
        const totalBytes = data.items.reduce((s, i) => s + (i.size || 0), 0);
        document.getElementById("totalSize").textContent = data.total_size;
    } catch(e) {
        toast("서버 연결 오류");
    }
}

function renderBreadcrumb(path) {
    const bc = document.getElementById("breadcrumb");
    let html = '<a onclick="loadDirectory(\'\')">🏠 홈</a>';
    if (path) {
        const parts = path.split("/").filter(Boolean);
        let accumulated = "";
        for (const part of parts) {
            accumulated += (accumulated ? "/" : "") + part;
            const p = accumulated;
            html += '<span class="sep">/</span>';
            html += `<a onclick="loadDirectory('${p.replace(/'/g, "\\'")}')">${part}</a>`;
        }
    }
    bc.innerHTML = html;
}

function renderFileList(items) {
    const body = document.getElementById("fileListBody");
    if (items.length === 0) {
        body.innerHTML = '<div class="empty-state"><div class="icon">📂</div><p>빈 폴더입니다</p></div>';
        return;
    }
    let html = "";
    for (const item of items) {
        const icon = getIcon(item);
        const clickAction = item.is_dir
            ? `loadDirectory('${(currentPath ? currentPath + "/" : "") + item.name}')`
            : `downloadFile('${(currentPath ? currentPath + "/" : "") + item.name}')`;
        const itemPath = (currentPath ? currentPath + "/" : "") + item.name;
        html += `<div class="file-row" ondblclick="${clickAction.replace(/"/g, '&quot;')}">
            <div class="file-icon">${icon}</div>
            <div class="file-name" title="${item.name}">${item.name}</div>
            <div class="file-size">${item.is_dir ? "-" : item.size_str}</div>
            <div class="file-date">${item.modified}</div>
            <div class="file-actions">
                <button title="이름 변경" onclick="event.stopPropagation();showRename('${itemPath.replace(/'/g, "\\'")}','${item.name.replace(/'/g, "\\'")}')">✏️</button>
                <button title="삭제" onclick="event.stopPropagation();deleteItem('${itemPath.replace(/'/g, "\\'")}','${item.name.replace(/'/g, "\\'")}')">🗑️</button>
            </div>
        </div>`;
    }
    body.innerHTML = html;
}

function goUp() {
    if (!currentPath) return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    loadDirectory(parts.join("/"));
}

function downloadFile(path) {
    window.open("/api/download?path=" + encodeURIComponent(path), "_blank");
}

function showNewFolderModal() {
    document.getElementById("newFolderName").value = "";
    showModal("newFolderModal");
    setTimeout(() => document.getElementById("newFolderName").focus(), 100);
}

async function createFolder() {
    const name = document.getElementById("newFolderName").value.trim();
    if (!name) { toast("폴더 이름을 입력하세요"); return; }
    const result = await apiPost("/api/mkdir", {
        path: currentPath ? currentPath + "/" + name : name
    });
    closeModal("newFolderModal");
    if (result.error) { toast("오류: " + result.error); }
    else { toast("폴더가 생성되었습니다"); loadDirectory(currentPath); }
}

async function deleteItem(path, name) {
    if (!confirm(`"${name}"을(를) 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    const result = await apiPost("/api/delete", { path });
    if (result.error) { toast("오류: " + result.error); }
    else { toast("삭제되었습니다"); loadDirectory(currentPath); }
}

function showRename(path, currentName) {
    renameTarget = path;
    document.getElementById("renameInput").value = currentName;
    showModal("renameModal");
    setTimeout(() => {
        const input = document.getElementById("renameInput");
        input.focus();
        const dot = currentName.lastIndexOf(".");
        input.setSelectionRange(0, dot > 0 ? dot : currentName.length);
    }, 100);
}

async function doRename() {
    const newName = document.getElementById("renameInput").value.trim();
    if (!newName) { toast("이름을 입력하세요"); return; }
    const parts = renameTarget.split("/");
    parts.pop();
    const newPath = (parts.length ? parts.join("/") + "/" : "") + newName;
    const result = await apiPost("/api/rename", { old_path: renameTarget, new_path: newPath });
    closeModal("renameModal");
    if (result.error) { toast("오류: " + result.error); }
    else { toast("이름이 변경되었습니다"); loadDirectory(currentPath); }
}

async function organizeFiles() {
    if (!confirm("현재 폴더의 파일들을 확장자별로 자동 정리하시겠습니까?")) return;
    const result = await apiPost("/api/organize", { path: currentPath });
    if (result.error) { toast("오류: " + result.error); return; }
    let html = `<p><strong>${result.moved}개</strong> 파일이 정리되었습니다.</p>`;
    if (result.categories && Object.keys(result.categories).length > 0) {
        for (const [cat, count] of Object.entries(result.categories)) {
            const icons = {"이미지":"🖼️","문서":"📄","동영상":"🎬","음악":"🎵","압축파일":"📦","코드":"💻","기타":"📁"};
            html += `<div class="cat-item">${icons[cat]||"📁"} ${cat}: ${count}개</div>`;
        }
    }
    if (result.moved === 0) {
        html = "<p>정리할 파일이 없습니다.</p>";
    }
    document.getElementById("organizeResult").innerHTML = html;
    showModal("organizeModal");
}

// Init
loadDirectory("");
</script>
</body>
</html>
"""


class FileManagerHandler(http.server.BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass  # 로그 출력 비활성화

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_html(self, html):
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        params = urllib.parse.parse_qs(parsed.query)

        if path == "/":
            self.send_html(HTML_PAGE)
        elif path == "/api/list":
            self.handle_list(params)
        elif path == "/api/download":
            self.handle_download(params)
        else:
            self.send_json({"error": "찾을 수 없는 경로입니다"}, 404)

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 10240:
            self.send_json({"error": "요청이 너무 큽니다"}, 413)
            return
        body = self.rfile.read(content_length)
        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            self.send_json({"error": "잘못된 요청입니다"}, 400)
            return

        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/mkdir":
            self.handle_mkdir(data)
        elif path == "/api/delete":
            self.handle_delete(data)
        elif path == "/api/rename":
            self.handle_rename(data)
        elif path == "/api/organize":
            self.handle_organize(data)
        else:
            self.send_json({"error": "찾을 수 없는 경로입니다"}, 404)

    def handle_list(self, params):
        req_path = params.get("path", [""])[0]
        real = safe_path(req_path)
        if real is None:
            self.send_json({"error": "접근이 거부되었습니다"}, 403)
            return
        if not os.path.isdir(real):
            self.send_json({"error": "디렉토리가 아닙니다"}, 400)
            return

        items = []
        total_size = 0
        try:
            with os.scandir(real) as entries:
                for entry in entries:
                    if entry.name.startswith("."):
                        continue
                    try:
                        stat = entry.stat()
                        ext = os.path.splitext(entry.name)[1].lower()
                        category = EXT_TO_CATEGORY.get(ext, "기타") if not entry.is_dir() else ""
                        size = stat.st_size if not entry.is_dir() else 0
                        total_size += size
                        items.append({
                            "name": entry.name,
                            "is_dir": entry.is_dir(),
                            "size": size,
                            "size_str": format_size(size) if not entry.is_dir() else "",
                            "modified": time.strftime("%Y-%m-%d %H:%M", time.localtime(stat.st_mtime)),
                            "extension": ext,
                            "category": category,
                        })
                    except (PermissionError, OSError):
                        continue
        except PermissionError:
            self.send_json({"error": "접근 권한이 없습니다"}, 403)
            return

        # 폴더 먼저, 이름순 정렬
        items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))

        self.send_json({
            "path": req_path,
            "items": items,
            "total_size": format_size(total_size),
        })

    def handle_download(self, params):
        req_path = params.get("path", [""])[0]
        real = safe_path(req_path)
        if real is None or not os.path.isfile(real):
            self.send_json({"error": "파일을 찾을 수 없습니다"}, 404)
            return
        try:
            size = os.path.getsize(real)
            filename = os.path.basename(real)
            encoded_name = urllib.parse.quote(filename)
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(size))
            self.send_header("Content-Disposition",
                             f"attachment; filename*=UTF-8''{encoded_name}")
            self.end_headers()
            with open(real, "rb") as f:
                while True:
                    chunk = f.read(65536)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        except (PermissionError, OSError) as e:
            self.send_json({"error": str(e)}, 500)

    def handle_mkdir(self, data):
        req_path = data.get("path", "")
        real = safe_path(req_path)
        if real is None:
            self.send_json({"error": "접근이 거부되었습니다"}, 403)
            return
        try:
            os.makedirs(real, exist_ok=True)
            self.send_json({"success": True})
        except OSError as e:
            self.send_json({"error": f"폴더 생성 실패: {e}"}, 500)

    def handle_delete(self, data):
        req_path = data.get("path", "")
        real = safe_path(req_path)
        if real is None:
            self.send_json({"error": "접근이 거부되었습니다"}, 403)
            return
        if real == os.path.realpath(BASE_DIR):
            self.send_json({"error": "루트 디렉토리는 삭제할 수 없습니다"}, 400)
            return
        try:
            if os.path.isdir(real):
                shutil.rmtree(real)
            else:
                os.remove(real)
            self.send_json({"success": True})
        except OSError as e:
            self.send_json({"error": f"삭제 실패: {e}"}, 500)

    def handle_rename(self, data):
        old_path = data.get("old_path", "")
        new_path = data.get("new_path", "")
        real_old = safe_path(old_path)
        real_new = safe_path(new_path)
        if real_old is None or real_new is None:
            self.send_json({"error": "접근이 거부되었습니다"}, 403)
            return
        if not os.path.exists(real_old):
            self.send_json({"error": "원본을 찾을 수 없습니다"}, 404)
            return
        try:
            os.rename(real_old, real_new)
            self.send_json({"success": True})
        except OSError as e:
            self.send_json({"error": f"이름 변경 실패: {e}"}, 500)

    def handle_organize(self, data):
        req_path = data.get("path", "")
        real = safe_path(req_path)
        if real is None:
            self.send_json({"error": "접근이 거부되었습니다"}, 403)
            return
        if not os.path.isdir(real):
            self.send_json({"error": "디렉토리가 아닙니다"}, 400)
            return

        moved = 0
        categories = {}
        try:
            with os.scandir(real) as entries:
                for entry in entries:
                    if entry.is_dir() or entry.name.startswith("."):
                        continue
                    ext = os.path.splitext(entry.name)[1].lower()
                    cat = EXT_TO_CATEGORY.get(ext, "기타")
                    dest_dir = os.path.join(real, cat)
                    os.makedirs(dest_dir, exist_ok=True)
                    dest = unique_dest(os.path.join(dest_dir, entry.name))
                    shutil.move(entry.path, dest)
                    moved += 1
                    categories[cat] = categories.get(cat, 0) + 1
        except OSError as e:
            self.send_json({"error": f"정리 실패: {e}"}, 500)
            return

        self.send_json({"success": True, "moved": moved, "categories": categories})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="파일 관리자 - 웹 기반 원격 파일 관리 도구")
    parser.add_argument("--port", type=int, default=8000, help="서버 포트 (기본: 8000)")
    parser.add_argument("--dir", type=str, default=".", help="관리할 디렉토리 (기본: 현재 디렉토리)")
    parser.add_argument("--public", action="store_true", help="외부 접속 허용 (기본: localhost만)")
    args = parser.parse_args()

    BASE_DIR = os.path.realpath(args.dir)
    host = "0.0.0.0" if args.public else "127.0.0.1"

    server = http.server.HTTPServer((host, args.port), FileManagerHandler)
    print(f"╔══════════════════════════════════════════╗")
    print(f"║        파일 관리자 서버 시작              ║")
    print(f"╠══════════════════════════════════════════╣")
    print(f"║  주소: http://{host}:{args.port:<5}               ║")
    print(f"║  디렉토리: {BASE_DIR:<29}║")
    print(f"╚══════════════════════════════════════════╝")
    print(f"\n브라우저에서 http://localhost:{args.port} 에 접속하세요.")
    print("종료하려면 Ctrl+C 를 누르세요.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n서버가 종료되었습니다.")
        server.server_close()
