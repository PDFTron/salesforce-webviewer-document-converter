var resourceURL = '/resource/'
window.CoreControls.forceBackendType('ems');

var urlSearch = new URLSearchParams(location.hash)
var custom = JSON.parse(urlSearch.get('custom'));
resourceURL = resourceURL + custom.namespacePrefix + "_";


/**
 * The following `window.CoreControls.set*` functions point WebViewer to the
 * optimized source code specific for the Salesforce platform, to ensure the
 * uploaded files stay under the 5mb limit
 */
// office workers
window.CoreControls.setOfficeWorkerPath(resourceURL + 'office')
window.CoreControls.setOfficeAsmPath(resourceURL + 'office_asm');
window.CoreControls.setOfficeResourcePath(resourceURL + 'office_resource');

// pdf workers
window.CoreControls.setPDFResourcePath(resourceURL + 'resource')
if (custom.fullAPI) {
  window.CoreControls.setPDFWorkerPath(resourceURL + 'pdf_full')
  window.CoreControls.setPDFAsmPath(resourceURL + 'asm_full');
} else {
  window.CoreControls.setPDFWorkerPath(resourceURL + 'pdf_lean')
  window.CoreControls.setPDFAsmPath(resourceURL + 'asm_lean');
}

// external 3rd party libraries
window.CoreControls.setExternalPath(resourceURL + 'external')
window.CoreControls.setCustomFontURL('https://pdftron.s3.amazonaws.com/custom/ID-zJWLuhTffd3c/vlocity/webfontsv20/');

let currentDocId;



window.addEventListener('viewerLoaded', async function () {
  const { Feature } = instance;

  const featureArray = [
    Feature.Measurement,
    Feature.Annotations,
    Feature.Ribbons,
    Feature.LocalStorage,
    Feature.NotesPanel,
    Feature.Redaction,
    Feature.MultipleViewerMerging,
    Feature.ThumbnailMerging,
    Feature.ThumbnailReordering,
    Feature.OutlineEditing,
    Feature.NotesPanelVirtualizedList
  ];
  instance.disableFeatures(featureArray);

  instance.textPopup.update([instance.textPopup.getItems()[0]])
  instance.UI.disableElements(['header']);
});

window.addEventListener("message", receiveMessage, false);


function receiveMessage(event) {
  if (event.isTrusted && typeof event.data === 'object') {
    switch (event.data.type) {
      case 'OPEN_DOCUMENT':
        console.log(event.data.file);
        instance.loadDocument(event.data.file)
        break;
      case 'OPEN_DOCUMENT_BLOB':
        const { blob, extension, filename, documentId } = event.data.payload;
        console.log("documentId", documentId);
        currentDocId = documentId;
        instance.loadDocument(blob, { extension, filename, documentId },)
        break;
      case 'CLOSE_DOCUMENT':
        instance.closeDocument()
        break;
      case 'DOCUMENT_SAVED':
        console.log(`${JSON.stringify(event.data)}`);
        instance.showErrorMessage('Document saved ');
        setTimeout(() => {
          instance.closeElements(['errorModal', 'loadingModal'])
        }, 2000)
        break
      case 'EXPORT_DOCUMENT':
        transportDocument(event.data.payload, true)
        break;
      case 'DOWNLOAD_DOCUMENT':
        transportDocument(event.data.payload, false)
        break;
      default:
        break;
    }
  }
}

function transportDocument(payload, transport){
  switch (payload.exportType) {
    case 'jpg':
    case 'png':
      // PDF to Image (png, jpg)
      pdfToImage(payload, transport);
      break;
    case 'pdf':
      // DOC, Images to PDF
      toPdf(payload, transport);
      break;
  }
}

// Basic function that retrieves any viewable file from the viewer and downloads it as a pdf
async function toPdf (payload, transport) {
  if (transport){

      const doc = instance.Core.documentViewer.getDocument();
      const buffer = await doc.getFileData({ downloadType: payload.exportType });
      const bufferFile = new Uint8Array(buffer);

      saveFile(bufferFile, payload.file, "." + payload.exportType);

  } else {
    let file = payload.file;

    parent.postMessage({ type: 'DOWNLOAD_DOCUMENT', file }, '*');
    instance.downloadPdf({filename: payload.file});

  }
}



const pdfToImage = async (payload, transport) => {

  await PDFNet.initialize();

  let doc = null;

  await PDFNet.runWithCleanup(async () => {

    const buffer = await payload.blob.arrayBuffer();
    doc = await PDFNet.PDFDoc.createFromBuffer(buffer);
    doc.initSecurityHandler();
    doc.lock();

    const count = await doc.getPageCount();
    const pdfdraw = await PDFNet.PDFDraw.create(92);
    
    let itr;
    let currPage;
    let bufferFile;

    // Handle multiple pages
    for (let i = 1; i <= count; i++){

      itr = await doc.getPageIterator(i);
      currPage = await itr.current();
      bufferFile = await pdfdraw.exportStream(currPage, payload.exportType.toUpperCase());
      transport ? saveFile(bufferFile, payload.file, "." + payload.exportType) : downloadFile(bufferFile, payload.file, "." + payload.exportType);

    }

  }); 

}










// Master download method
const downloadFile = (buffer, fileName, fileExtension) => {
  const blob = new Blob([buffer]);
  const link = document.createElement('a');

  const file = fileName + fileExtension;
  // create a blobURI pointing to our Blob
  link.href = URL.createObjectURL(blob);
  link.download = file
  // some browser needs the anchor to be in the doc
  document.body.append(link);
  link.click();
  link.remove();


  parent.postMessage({ type: 'DOWNLOAD_DOCUMENT', file }, '*')
  // in case the Blob uses a lot of memory
  setTimeout(() => URL.revokeObjectURL(link.href), 7000);
  
};

function saveFile (buffer, fileName, fileExtension) {
  const docLimit = 5 * Math.pow(1024, 2);
  const fileSize = buffer.byteLength;

  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }

  const base64Data = window.btoa(binary);

  const payload = {
    title: fileName.replace(/\.[^/.]+$/, ""),
    filename: fileName + fileExtension,
    base64Data,
    contentDocumentId: currentDocId
  }
  console.log(payload);
  // Post message to LWC
  fileSize < docLimit ? parent.postMessage({ type: 'SAVE_DOCUMENT', payload }, '*') : downloadFile(buffer, fileName, "." + fileExtension);
}

