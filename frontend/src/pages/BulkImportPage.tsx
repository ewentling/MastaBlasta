import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react';

interface CSVRow {
  content: string;
  platforms?: string;
  account_ids?: string;
  scheduled_time?: string;
  media?: string;
}

export default function BulkImportPage() {
  const [csvData, setCSVData] = useState<CSVRow[]>([]);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [scheduleAll, setScheduleAll] = useState(false);
  const queryClient = useQueryClient();

  // Fetch import history
  const { data: importsData } = useQuery({
    queryKey: ['bulk-imports'],
    queryFn: () => fetch('/api/bulk-import').then(res => res.json())
  });

  const validateMutation = useMutation({
    mutationFn: (data: CSVRow[]) =>
      fetch('/api/bulk-import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: data })
      }).then(res => res.json()),
    onSuccess: (data) => {
      setValidationResult(data);
      setShowPreview(true);
    }
  });

  const executeMutation = useMutation({
    mutationFn: (data: { rows: CSVRow[], schedule_all: boolean }) =>
      fetch('/api/bulk-import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulk-imports'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setCSVData([]);
      setValidationResult(null);
      setShowPreview(false);
      alert('Bulk import completed successfully!');
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = parseCSV(text);
      setCSVData(rows);
      validateMutation.mutate(rows);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: any = {};
      
      headers.forEach((header, index) => {
        if (values[index]) {
          row[header] = values[index].trim();
        }
      });

      if (row.content) {
        rows.push(row);
      }
    }

    return rows;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    
    return result.map(v => v.replace(/^"|"$/g, ''));
  };

  const downloadTemplate = () => {
    const template = `content,platforms,account_ids,scheduled_time,media
"Your post content here","twitter,facebook","","2026-01-15T10:00:00Z",""
"Another post with scheduled time","linkedin","","2026-01-16T14:30:00Z",""
"Post with media URL","instagram","","","https://example.com/image.jpg"`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-header">
        <h2>Bulk Upload & CSV Import</h2>
        <p>Import multiple posts at once from CSV files</p>
      </div>

      {/* Upload Section */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-header">
          <h3>Upload CSV File</h3>
          <button className="btn btn-secondary btn-small" onClick={downloadTemplate}>
            <Download size={16} />
            Download Template
          </button>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{
            border: '2px dashed var(--color-borderLight)',
            borderRadius: '8px',
            padding: '3rem 2rem',
            backgroundColor: 'var(--color-bgSecondary)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'var(--color-accentPrimary)';
            e.currentTarget.style.backgroundColor = 'var(--color-bgPrimary)';
          }}
          onDragLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-borderLight)';
            e.currentTarget.style.backgroundColor = 'var(--color-bgSecondary)';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'var(--color-borderLight)';
            e.currentTarget.style.backgroundColor = 'var(--color-bgSecondary)';
            
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'text/csv') {
              const input = document.getElementById('csv-upload') as HTMLInputElement;
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(file);
              input.files = dataTransfer.files;
              handleFileUpload({ target: input } as any);
            }
          }}
          onClick={() => document.getElementById('csv-upload')?.click()}
          >
            <Upload size={48} style={{ color: 'var(--color-accentPrimary)', marginBottom: '1rem' }} />
            <div style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--color-textPrimary)' }}>
              Click to upload or drag and drop
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>
              CSV files only (max 10MB)
            </div>
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </div>

          {csvData.length > 0 && (
            <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                padding: '1rem',
                backgroundColor: 'var(--color-bgPrimary)',
                borderRadius: '8px',
                border: '1px solid var(--color-borderLight)'
              }}>
                <FileText size={20} style={{ color: 'var(--color-accentPrimary)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: 'var(--color-textPrimary)' }}>
                    {csvData.length} rows loaded
                  </div>
                  {validationResult && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)', marginTop: '0.25rem' }}>
                      {validationResult.valid ? (
                        <span style={{ color: '#10b981' }}>
                          <CheckCircle size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                          All rows valid
                        </span>
                      ) : (
                        <span style={{ color: '#ef4444' }}>
                          <XCircle size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                          {validationResult.errors.length} errors found
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSV Format Guide */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-header">
          <h3>CSV Format Guide</h3>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--color-textPrimary)' }}>
              Required Columns:
            </div>
            <ul style={{ marginLeft: '1.5rem', color: 'var(--color-textSecondary)' }}>
              <li><code>content</code> - The post content (required)</li>
            </ul>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--color-textPrimary)' }}>
              Optional Columns:
            </div>
            <ul style={{ marginLeft: '1.5rem', color: 'var(--color-textSecondary)' }}>
              <li><code>platforms</code> - Comma-separated platform names (twitter, facebook, instagram, linkedin)</li>
              <li><code>account_ids</code> - Comma-separated account IDs from your accounts</li>
              <li><code>scheduled_time</code> - ISO 8601 format (e.g., 2026-01-15T10:00:00Z)</li>
              <li><code>media</code> - Media URL (optional)</li>
            </ul>
          </div>
          <div style={{ 
            padding: '1rem', 
            backgroundColor: 'var(--color-bgSecondary)', 
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            color: 'var(--color-textSecondary)'
          }}>
            <div>Example CSV:</div>
            <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
{`content,platforms,scheduled_time
"Check out our new product!","twitter,facebook","2026-01-15T10:00:00Z"
"Happy Monday everyone!","linkedin","2026-01-16T09:00:00Z"`}
            </pre>
          </div>
        </div>
      </div>

      {/* Validation Results & Preview */}
      {showPreview && validationResult && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <h3>Validation Results</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            {/* Summary */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ padding: '1rem', backgroundColor: 'var(--color-bgSecondary)', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-textPrimary)' }}>
                  {validationResult.total_rows}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>Total Rows</div>
              </div>
              <div style={{ padding: '1rem', backgroundColor: 'var(--color-bgSecondary)', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
                  {validationResult.valid_rows}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>Valid Rows</div>
              </div>
              <div style={{ padding: '1rem', backgroundColor: 'var(--color-bgSecondary)', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ef4444' }}>
                  {validationResult.errors.length}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>Errors</div>
              </div>
            </div>

            {/* Errors */}
            {validationResult.errors.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ 
                  fontWeight: '600', 
                  marginBottom: '0.75rem',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <XCircle size={20} />
                  Errors Found
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {validationResult.errors.map((error: any, index: number) => (
                    <div 
                      key={index}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        color: '#991b1b'
                      }}
                    >
                      <div style={{ fontWeight: '600' }}>Row {error.row}:</div>
                      <ul style={{ marginLeft: '1.5rem', marginTop: '0.25rem' }}>
                        {error.errors.map((err: string, i: number) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {validationResult.warnings.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ 
                  fontWeight: '600', 
                  marginBottom: '0.75rem',
                  color: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <AlertCircle size={20} />
                  Warnings
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {validationResult.warnings.map((warning: any, index: number) => (
                    <div 
                      key={index}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: '8px',
                        color: '#92400e'
                      }}
                    >
                      <div style={{ fontWeight: '600' }}>Row {warning.row}:</div>
                      <ul style={{ marginLeft: '1.5rem', marginTop: '0.25rem' }}>
                        {warning.warnings.map((warn: string, i: number) => (
                          <li key={i}>{warn}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Import Options */}
            {validationResult.valid && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-borderLight)' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={scheduleAll}
                      onChange={(e) => setScheduleAll(e.target.checked)}
                    />
                    <span>
                      Schedule all posts automatically (posts without scheduled_time will be scheduled at 5-minute intervals)
                    </span>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => executeMutation.mutate({ rows: csvData, schedule_all: scheduleAll })}
                    disabled={executeMutation.isPending}
                  >
                    {executeMutation.isPending ? 'Importing...' : `Import ${validationResult.valid_rows} Posts`}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowPreview(false);
                      setCSVData([]);
                      setValidationResult(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import History */}
      {importsData && importsData.imports.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Import History</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {importsData.imports.map((importJob: any) => (
                <div
                  key={importJob.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid var(--color-borderLight)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-bgSecondary)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--color-textPrimary)' }}>
                        Import #{importJob.id.substring(0, 8)}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>
                        {new Date(importJob.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: '700', color: 'var(--color-textPrimary)' }}>
                          {importJob.total_rows}
                        </div>
                        <div style={{ color: 'var(--color-textSecondary)' }}>Total</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: '700', color: '#10b981' }}>
                          {importJob.successful}
                        </div>
                        <div style={{ color: 'var(--color-textSecondary)' }}>Success</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: '700', color: '#ef4444' }}>
                          {importJob.failed}
                        </div>
                        <div style={{ color: 'var(--color-textSecondary)' }}>Failed</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
