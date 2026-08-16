/**
 * BILLFLOW AI - SERVER-SIDE GEMINI AI VISION CLIENT
 * Connects directly to backend /api/ai/extract with key from .env
 */

const AIService = {
  // Helper to convert File to Base64
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result.split(',')[1];
        resolve({
          base64: base64String,
          mimeType: file.type || 'image/jpeg',
          dataUrl: reader.result
        });
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  },

  // Process an invoice image via Backend Gemini Vision API
  async extractInvoiceFromImage(fileOrDataUrl, progressCallback = () => {}) {
    progressCallback({ status: 'reading_file', message: 'Đang tải file & gọi AI Vision...' });

    let base64Data = '';
    let mimeType = 'image/jpeg';
    let previewUrl = '';
    let fileName = 'hoa-don.jpg';

    if (fileOrDataUrl instanceof File || fileOrDataUrl instanceof Blob) {
      fileName = fileOrDataUrl.name || 'hoa-don.jpg';
      const converted = await this.fileToBase64(fileOrDataUrl);
      base64Data = converted.base64;
      mimeType = converted.mimeType;
      previewUrl = converted.dataUrl;
    } else if (typeof fileOrDataUrl === 'string') {
      previewUrl = fileOrDataUrl;
      if (fileOrDataUrl.startsWith('data:')) {
        const parts = fileOrDataUrl.split(',');
        mimeType = parts[0].match(/:(.*?);/)[1] || 'image/jpeg';
        base64Data = parts[1];
      }
    }

    progressCallback({ status: 'ai_analyzing', message: 'Gemini Vision AI đang đọc dữ liệu chứng từ...' });

    try {
      const res = await AuthService.authFetch('/api/ai/extract', {
        method: 'POST',
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType,
          fileName
        })
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Lỗi xử lý bóc tách từ máy chủ');
      }

      const extracted = result.data;
      extracted.previewUrl = previewUrl;
      extracted.fileName = fileName;

      progressCallback({ status: 'done', message: 'Hoàn tất bóc tách!' });
      return extracted;
    } catch (err) {
      console.error('AI Service extraction error:', err);
      throw err;
    }
  }
};
