import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
        <div className="page">
            <div className="page-grain" aria-hidden="true" />

            <main className="sheet">
                <header className="masthead">
                    <div className="masthead-rule">
                        <span>The Condenser</span>
                        <span className="masthead-mark" aria-hidden="true">¶</span>
                        <span>No. 01 · GPT</span>
                    </div>
                    <p className="kicker">A document condenser</p>
                    <h1 className="wordmark">
                        BriefPDF&nbsp;<em>Reader</em>
                    </h1>
                    <p className="dek">
                        Long documents, distilled. Hand over a PDF and receive a faithful
                        summary — you set the length, we set the type.
                    </p>
                </header>

                <form className="composer" onSubmit={handleSubmit}>
                    <div className="field">
                        <span className="field-num" aria-hidden="true">01</span>
                        <div className="field-body">
                            <label className="field-label" htmlFor="fileInput">
                                The manuscript
                            </label>
                            <input
                                type="file"
                                id="fileInput"
                                className="field-file"
                                accept=".pdf"
                                onChange={handleFileChange}
                            />
                            <label className="dropzone" htmlFor="fileInput">
                                <span className={selectedFile ? 'dropzone-name is-set' : 'dropzone-name'}>
                                    {selectedFile ? selectedFile.name : 'Choose a PDF to condense'}
                                </span>
                                <span className="dropzone-cta">Browse</span>
                            </label>
                        </div>
                    </div>

                    <div className="field">
                        <span className="field-num" aria-hidden="true">02</span>
                        <div className="field-body">
                            <label className="field-label" htmlFor="wordInput">
                                Target length
                            </label>
                            <div className="count-row">
                                <input
                                    type="number"
                                    id="wordInput"
                                    min="10"
                                    max="2500"
                                    value={maxWords}
                                    onChange={(e) => setMaxWords(e.target.value)}
                                    className="count-input"
                                />
                                <span className="count-unit">words, give or take</span>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={!selectedFile || loading}
                        className={loading ? 'press is-working' : 'press'}
                    >
                        <span className="press-label">
                            {loading ? 'Setting type' : 'Condense the document'}
                        </span>
                        <span className="press-meta" aria-hidden="true">
                            {loading ? '¶' : `≈ ${maxWords || 0} words`}
                        </span>
                    </button>
                </form>

                {error && (
                    <div className="proof proof-error" role="alert">
                        <span className="proof-tag">Set aside</span>
                        <p className="proof-text">{error}</p>
                    </div>
                )}

                {result && (
                    <article className="excerpt">
                        <div className="excerpt-head">
                            <span className="excerpt-tag">The summary</span>
                            <span className="excerpt-meta">≈ {maxWords} words</span>
                        </div>
                        <div className="excerpt-body">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                        </div>
                        <div className="excerpt-foot" aria-hidden="true">¶</div>
                    </article>
                )}

                <footer className="colophon">
                    <span>Set in Fraunces &amp; Newsreader</span>
                    <span aria-hidden="true">¶</span>
                    <span>Composed with care</span>
                </footer>
            </main>
        </div>
    );
}

export default PDFSummary;
