import { LightningElement, track, wire, api } from 'lwc';
import { fireEvent, registerListener, unregisterAllListeners } from 'c/pubsub';
import { CurrentPageReference } from 'lightning/navigation';


export default class ExportFile extends LightningElement {



    hasSpinner = false;

    @wire(CurrentPageReference)
    pageRef;

    file_options;
    value;

    pdfaValue = 'e_Level1A';
    pdfaSelect = false;

    payload;

    pdfa_conformance = [
        {label: 'PDF/A-1A', value: 'e_Level1A'},
        {label: 'PDF/A-1B', value: 'e_Level1B'},
        {label: 'PDF/A-2A', value: 'e_Level2A'},
        {label: 'PDF/A-2B', value: 'e_Level2B'},
        {label: 'PDF/A-2U', value: 'e_Level2U'},
        {label: 'PDF/A-3A', value: 'e_Level3A'},
        {label: 'PDF/A-3B', value: 'e_Level3B'},
        {label: 'PDF/A-3U', value: 'e_Level3U'}
    ]
    
    pdf_options = [
        { label: 'JPG', value: 'jpg' },
        { label: 'PNG', value: 'png' },
        { label: 'PDF/A', value: 'pdfa' },
        { label: 'TIFF', value: 'tiff' }
        // { label: 'Word', value: 'docx' },
        // { label: 'PowerPoint', value: 'pptx' },
        // { label: 'Excel', value: 'xlsx' },
        // { label: 'HTML', value: 'html' }
        
    ]

    other_options = [
        { label: 'PDF', value: 'pdf' }
    ]

    connectedCallback() {
        registerListener('blobSelected', this.handleBlobSelected, this);
        registerListener('finishConvert', this.handleFinishConvert, this)
        registerListener('clearSelected', this.handleClearSelected, this);
    }

    handleClearSelected(){
        this.file_options = [];
        this.value = undefined;
        this.pdfaSelect = false;
        this.payload = undefined;
    }

    handleBlobSelected(record) {
        if (record.cv.FileExtension == 'pdf'){
            this.file_options = this.pdf_options;
            this.value = 'jpg';
        } else { 
            this.file_options = this.other_options;
            this.value = 'pdf';
        }
        this.payload = {
            value: this.value
        }
    }

    


    handleExport(){
        if(this.value){
            this.hasSpinner = true;
            this.payload.transport = 'EXPORT_DOCUMENT';
            fireEvent(this.pageRef, 'transport_document', this.payload);
        }
    }

    handleDownload(){
        if(this.value){
            this.hasSpinner = true;
            this.payload.transport = 'DOWNLOAD_DOCUMENT';
            fireEvent(this.pageRef, 'transport_document', this.payload);
        }
    }


    handleChange(event){
        const label = event.target.options.find(opt => opt.value === event.detail.value).label;
        this.value = event.detail.value;
        if (label == 'PDF/A'){
            this.pdfaSelect = true;
            this.payload = {
                value: event.detail.value,
                conform: this.pdfaValue
            }
        } else {
            this.pdfaSelect = false;
            this.payload = {
                value: event.detail.value
            }
        }
    }

    handleChangePDFA(event){
        this.pdfaValue = event.detail.value;
        this.payload.conform = this.pdfaValue;
    }

    handleFinishConvert(){
        this.hasSpinner = false;
    }
}