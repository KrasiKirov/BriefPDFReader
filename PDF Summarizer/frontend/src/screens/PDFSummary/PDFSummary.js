import React, { useState } from 'react';
import './style/style.css';
import axios from 'axios';

// In production the frontend and backend are on different origins, so the API
// base URL is configured at build time. Empty in dev -> relative path uses the
// CRA proxy (package.json "proxy").
const API_BASE = process.env.REACT_APP_API_BASE_URL || '';

function PDFSummary() {
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [maxWords, setMaxWords] = useState(100);
    const [selectedFile, setSelectedFile] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        setSelectedFile(file);
    }

    const handleSubmit = async (event) => {
        event.preventDefault();

        // Validate before entering the loading state so loading is never left
        // stuck "on" by an early return.
        if (!maxWords) {
            setError('Please enter a number of words for the summary.');
            setResult('');
            return;
        }

        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('pdf', selectedFile);
            formData.append('maxWords', maxWords);

            const response = await axios.post(`${API_BASE}/api/pdfsummary`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                timeout: 120000,
            });

            if (response.data.error) {
                setError(response.data.error);
                return;
            }

            setError('');
            setResult(response.data.summarisedText);

        } catch (error) {
            console.error(error);
            setResult('');
            // Surface the server's safe message (413/415/429/400) when present.
            const message =
                error.response?.data?.error ||
                (error.code === 'ECONNABORTED'
                    ? 'The request timed out. Try a smaller PDF.'
                    : 'An error occurred while submitting the form.');
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mt-5">
            <div className='hero d-flex align-items-center justify-content-center text-center flex-column p-5'>
                <h1 className='display-4 mb-4'>BriefPDF Reader</h1>
                <p className='lead mb-4'>Transform lengthy PDFs into concise summaries in seconds</p>
                <form className='w-100' onSubmit={handleSubmit}>
                    <div className="form-group file-upload-wrapper">
                        <input 
                            type='file' 
                            id='fileInput'
                            className='custom-file-input' 
                            accept='.pdf' 
                            onChange={handleFileChange}
                        />
                        <label className="custom-file-label" htmlFor="fileInput">
                            {selectedFile ? selectedFile.name : 'Choose a PDF file'}
                        </label>
                    </div>
                    <div className="form-group row">
                        <div className='col-sm-4 offset-sm-4'>
                            <input
                                type='number'
                                min='10'
                                max='2500'
                                value={maxWords}
                                onChange={(e) => setMaxWords(e.target.value)}
                                className='form-control custom-input'
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <button
                            type='submit'
                            disabled={!selectedFile || loading}
                            className='btn btn-primary custom-button mt-3 w-100'
                        >
                            {loading ? 'Analysing PDF...' : `Summarize PDF in about ${maxWords} words`}
                        </button>
                    </div>
                </form>
            </div>
            {error && <div className="alert alert-danger mt-3">{error}</div>}
            {result && <div className="alert alert-success mt-3">{result}</div>}
        </div>
    );
}

export default PDFSummary;
