// script.js
let selectedFiles = [];

window.onload = () => {
  const savedFiles = localStorage.getItem("pdfFileList");
  if (savedFiles) {
    const names = JSON.parse(savedFiles);
    document.getElementById("status").textContent = `📌 File list restored. Please reselect files for preview.`;
    const list = document.getElementById("reorderList");
    list.innerHTML = "";
    names.forEach(name => {
      const li = document.createElement("li");
      li.innerText = `📄 ${name} (reselect to preview)`;
      list.appendChild(li);
    });
  }
  renderHistory();
};

function promptPDFName() {
  if (selectedFiles.length < 2) return alert("Please select at least two PDF files.");
  const name = prompt("Enter name for merged PDF:", `merged_${Date.now()}.pdf`);
  if (name) mergePDFs(name.endsWith(".pdf") ? name : name + ".pdf");
}

async function mergePDFs(customName) {
  const mergedPdf = await PDFLib.PDFDocument.create();
  for (let file of selectedFiles) {
    const bytes = await file.arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(bytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach(page => mergedPdf.addPage(page));
  }
  const pdfBytes = await mergedPdf.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  download(pdfBytes, customName, "application/pdf");

  const history = JSON.parse(localStorage.getItem("mergeHistory")) || {};
  history[customName] = { url, timestamp: Date.now() };
  localStorage.setItem("mergeHistory", JSON.stringify(history));
  renderHistory();
  document.getElementById("status").textContent = "✅ Merged and saved!";
}

function download(blobData, filename, mimeType) {
  const blob = new Blob([blobData], { type: mimeType });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function resetAll() {
  selectedFiles = [];
  localStorage.removeItem("pdfFileList");
  document.getElementById('pdfFiles').value = "";
  document.getElementById("status").textContent = "";
  document.getElementById("previewList").innerHTML = "";
  document.getElementById("reorderList").innerHTML = "";
}

const themeButton = document.getElementById("themeToggle");
themeButton.addEventListener("click", () => {
  document.body.classList.toggle("light-theme");
  themeButton.textContent = document.body.classList.contains("light-theme") ? "🌙 Dark Mode" : "☀️ Light Mode";
});

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("pdfFiles");

["dragenter", "dragover"].forEach(event => {
  dropZone.addEventListener(event, e => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach(event => {
  dropZone.addEventListener(event, e => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
  });
});

dropZone.addEventListener("drop", e => {
  e.preventDefault();
  handleFileSelection(e.dataTransfer.files);
});

fileInput.addEventListener("change", () => handleFileSelection(fileInput.files));

function handleFileSelection(files) {
  const valid = Array.from(files).filter(file => file.type === "application/pdf");
  const rejected = Array.from(files).filter(file => file.type !== "application/pdf");
  if (rejected.length > 0) alert("🚫 Only PDF files are allowed!");
  selectedFiles = valid;
  localStorage.setItem("pdfFileList", JSON.stringify(valid.map(f => f.name)));
  previewPDFs();
}

function previewPDFs() {
  const previewList = document.getElementById('previewList');
  const reorderList = document.getElementById('reorderList');
  previewList.innerHTML = "";
  reorderList.innerHTML = "";
  selectedFiles.forEach(file => {
    const reader = new FileReader();
    reader.onload = async function () {
      const arrayBuffer = reader.result;
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
      const pageCount = pdfDoc.getPageCount();
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const fileSize = formatFileSize(file.size);
      const li = document.createElement("li");
      li.draggable = true;
      li.dataset.name = file.name;
      li.innerHTML = `📄 ${file.name} — ${pageCount} page${pageCount > 1 ? "s" : ""} — ${fileSize} <button onclick="removeFile('${file.name}')">🗑</button>`;
      reorderList.appendChild(li);
      const iframe = document.createElement("iframe");
      iframe.src = url;
      previewList.appendChild(iframe);
      makeSortable();
    };
    reader.readAsArrayBuffer(file);
  });
  document.getElementById("status").textContent = "📜 Preview loaded. Drag to reorder.";
}

function removeFile(name) {
  selectedFiles = selectedFiles.filter(file => file.name !== name);
  localStorage.setItem("pdfFileList", JSON.stringify(selectedFiles.map(f => f.name)));
  previewPDFs();
}

function makeSortable() {
  const list = document.getElementById('reorderList');
  let draggingEl;
  list.querySelectorAll("li").forEach(item => {
    item.addEventListener("dragstart", () => {
      draggingEl = item;
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => {
      draggingEl = null;
      item.classList.remove("dragging");
      updateSelectedFilesOrder();
    });
    item.addEventListener("dragover", e => {
      e.preventDefault();
      const afterElement = getDragAfterElement(list, e.clientY);
      if (afterElement == null) {
        list.appendChild(draggingEl);
      } else {
        list.insertBefore(draggingEl, afterElement);
      }
    });
  });
}

function updateSelectedFilesOrder() {
  const listItems = document.querySelectorAll('#reorderList li');
  const newOrder = [];
  listItems.forEach(li => {
    const fileName = li.dataset.name;
    const file = selectedFiles.find(f => f.name === fileName);
    if (file) newOrder.push(file);
  });
  selectedFiles = newOrder;
  localStorage.setItem("pdfFileList", JSON.stringify(selectedFiles.map(f => f.name)));
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

// Sidebar Toggle
const toggle = document.getElementById("historyToggle");
toggle.addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

// Render history
function renderHistory() {
  const list = document.getElementById("mergeHistoryList");
  const sortOrder = document.getElementById("sortHistory").value;
  list.innerHTML = "";
  let history = JSON.parse(localStorage.getItem("mergeHistory")) || {};
  let entries = Object.entries(history);
  entries.sort((a, b) => {
    const atime = a[1].timestamp || 0;
    const btime = b[1].timestamp || 0;
    return sortOrder === "newest" ? btime - atime : atime - btime;
  });
  for (const [name, data] of entries) {
    const li = document.createElement("li");
    const title = document.createElement("span");
    title.className = "history-title";
    title.textContent = name;
    title.onclick = () => window.open(data.url, "_blank");

    const downloadBtn = document.createElement("button");
    downloadBtn.innerHTML = "📥";
    downloadBtn.title = "Download";
    downloadBtn.onclick = (e) => {
      e.stopPropagation();
      const link = document.createElement("a");
      link.href = data.url;
      link.download = name;
      link.click();
    };

    const saveBtn = document.createElement("button");
    saveBtn.innerHTML = "💾";
    saveBtn.title = "Save to Disk";
    saveBtn.onclick = async (e) => {
      e.stopPropagation();
      await saveToFileSystem(data.url, name);
    };

    const menuWrapper = document.createElement("div");
    menuWrapper.className = "menu";

    const dots = document.createElement("button");
    dots.textContent = "⋯";
    dots.title = "Options";

    const options = document.createElement("div");
    options.className = "menu-options";
    options.innerHTML = `
      <button onclick="renameHistory('${name}')">✏️ Rename</button>
      <button onclick="shareHistory('${name}')">📤 Share</button>
      <button onclick="deleteHistory('${name}')">🗑 Delete</button>
    `;

    dots.onclick = (e) => {
      e.stopPropagation();
      const isVisible = options.style.display === "block";
      document.querySelectorAll(".menu-options").forEach(el => el.style.display = "none");
      options.style.display = isVisible ? "none" : "block";
    };

    menuWrapper.appendChild(dots);
    menuWrapper.appendChild(options);

    li.appendChild(title);
    li.appendChild(downloadBtn);
    li.appendChild(saveBtn);
    li.appendChild(menuWrapper);

    list.appendChild(li);
  }
  document.addEventListener("click", () => {
    document.querySelectorAll(".menu-options").forEach(el => el.style.display = "none");
  });
}

async function saveToFileSystem(url, filename) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }]
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    alert("✅ Saved to disk!");
  } catch (err) {
    console.error(err);
    alert("❌ Save failed or cancelled.");
  }
}
