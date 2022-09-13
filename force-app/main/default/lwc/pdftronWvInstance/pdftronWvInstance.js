import { LightningElement, wire, track, api } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import { loadScript } from 'lightning/platformResourceLoader';
import libUrl from '@salesforce/resourceUrl/lib';
import myfilesUrl from '@salesforce/resourceUrl/myfiles';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import mimeTypes from './mimeTypes'
import { fireEvent, registerListener, unregisterAllListeners } from 'c/pubsub';
import saveDocument from '@salesforce/apex/PDFTron_ContentVersionController.saveDocument';
import getUser from '@salesforce/apex/PDFTron_ContentVersionController.getUser';

function _base64ToArrayBuffer(base64) {
  var binary_string =  window.atob(base64);
  var len = binary_string.length;
  var bytes = new Uint8Array( len );
  for (var i = 0; i < len; i++)        {
      bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export default class PdftronWvInstance extends LightningElement {
  //initialization options
  fullAPI = true;
  enableRedaction = true;
  enableFilePicker = true;

  uiInitialized = false;

  payload;

  source = 'My file';
  @api recordId;

  @wire(CurrentPageReference)
  pageRef;

  username;

  connectedCallback() {
    registerListener('blobSelected', this.handleBlobSelected, this);
    registerListener('transport_document', this.transportDocument, this);
    registerListener('closeDocument', this.closeDocument, this);
    window.addEventListener('message', this.handleReceiveMessage);
  }

  disconnectedCallback() {
    unregisterAllListeners(this);
    window.removeEventListener('message', this.handleReceiveMessage);
  }

  handleBlobSelected(record) {
    const blobby = new Blob([_base64ToArrayBuffer(record.body)], {
      type: mimeTypes[record.FileExtension]
    });

    const payload = {
      blob: blobby,
      extension: record.cv.FileExtension,
      file: record.cv.Title,
      filename: record.cv.Title + "." + record.cv.FileExtension,
      documentId: record.cv.Id
    };

    this.payload = {...payload};

    switch (payload.extension){
      case 'tiff':
        this.iframeWindow.postMessage({ type: 'OPEN_TIFF_BLOB', payload }, '*');
        break;
      default:
        this.iframeWindow.postMessage({ type: 'OPEN_DOCUMENT_BLOB', payload }, '*');
        break;
    }

    
  }


  renderedCallback() {
    var self = this;

    if (this.uiInitialized) { 
        return;
    }

    Promise.all([
        loadScript(self, libUrl + '/webviewer.min.js')
    ])
    .then(() => this.handleInitWithCurrentUser())
    .catch(console.error);
  }

  handleInitWithCurrentUser() {
    getUser()
    .then((result) => {
        console.log(JSON.parse(JSON.stringify(result)));
        this.username = result;
        this.error = undefined;

        this.initUI();
    })
    .catch((error) => {
      console.error(error);
      this.showNotification('Error', error.body.message, 'error');
    });
  }

  async initUI() {
    // const customMetadataRecords = await getPdftronSettings();
    // const record = customMetadataRecords[0];
    // console.log(record);
    // const l = record ? window.atob(record[`PDFtron_WVDC__Permission_Level__c`]) : undefined;

    var myObj = {
      libUrl: libUrl,
      myfilesUrl,
      fullAPI: this.fullAPI || false,
      namespacePrefix: '',
      username: this.username,
    };
    var url = myfilesUrl + '/webviewer-demo-annotated.pdf';

    const viewerElement = this.template.querySelector('div')
    // eslint-disable-next-line no-unused-vars
    const viewer = new WebViewer({
      path: libUrl, // path to the PDFTron 'lib' folder on your server
      custom: JSON.stringify(myObj),
      backendType: 'ems',
      config: myfilesUrl + '/config_apex.js',
      fullAPI: this.fullAPI,
      enableFilePicker: this.enableFilePicker,
      enableRedaction: this.enableRedaction,
      enableMeasurement: this.enableMeasurement,
      // l: 'YOUR_LICENSE_KEY_HERE',
    }, viewerElement);

    viewerElement.addEventListener('ready', () => {
      this.iframeWindow = viewerElement.querySelector('iframe').contentWindow;
    })
  }


  handleReceiveMessage = (event) => {
    const me = this;
    if (event.isTrusted && typeof event.data === 'object') {
      switch (event.data.type) {
        case 'SAVE_DOCUMENT':
          const cvId = event.data.payload.contentDocumentId;
          saveDocument({ json: JSON.stringify(event.data.payload), recordId: this.recordId ? this.recordId : '', cvId: cvId })
          .then((response) => {
            me.iframeWindow.postMessage({ type: 'DOCUMENT_SAVED', response }, '*');
            
            fireEvent(this.pageRef, 'refreshOnSave', response);

            fireEvent(this.pageRef, 'finishConvert', '');
            this.showNotification('Success', event.data.payload.filename + ' Saved', 'success');
          })
          .catch(error => {
            me.iframeWindow.postMessage({ type: 'DOCUMENT_SAVED', error }, '*')
            fireEvent(this.pageRef, 'refreshOnSave', error);
            console.error(event.data.payload.contentDocumentId);
            console.error(JSON.stringify(error));
            this.showNotification('Error', error.body, 'error');
          });
          break;
        case 'DOWNLOAD_DOCUMENT':
          const body = event.data.file + ' Downloaded';
          fireEvent(this.pageRef, 'finishConvert', '');
          this.showNotification('Success', body, 'success');
          break;
        default:
          break;
      }
    }
  }

  

  @api
  closeDocument() {
    this.iframeWindow.postMessage({type: 'CLOSE_DOCUMENT' }, '*')
  }

  transportDocument(convert) {
    if(this.payload != null){
      const payload = {...this.payload};
      payload.exportType = convert.value;
      payload.transport = convert.transport;


      if(convert.conform){
        payload.conformType = convert.conform;
        this.iframeWindow.postMessage({type: convert.transport, payload }, '*');
      } else {
        this.iframeWindow.postMessage({type: convert.transport, payload }, '*');
      }
      
    } else {
      console.log('No file selected');
    }
  }
  
  showNotification (title, message, variant) {
    const evt = new ShowToastEvent({
      title: title,
      message: message,
      variant: variant
    })
    this.dispatchEvent(evt)
  }
}