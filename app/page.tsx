'use client';

import { useState } from 'react';

interface GenerationResult {
  success: boolean;
  prompt?: string;
  imageUrl?: string;
  messageId?: string;
  error?: string;
}

// 무게 옵션 (graduation과 동일: 1g ~ 10^10g)
const WEIGHT_OPTIONS = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000, 10000000000];

// 마키 이미지 (1~17)
const MARQUEE_IMAGES = Array.from({ length: 17 }, (_, i) => `/image/${i + 1}.png`);

export default function Home() {
  const [selectedNumber, setSelectedNumber] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);

  // 인쇄 설정 (영수증 용지 71mm 폭)
  const printWidthMm = 71;
  const maintainAspectRatio = true;
  const printQuality = 90;
  const grayscale = true;

  const handleSubmit = async () => {
    if (!selectedNumber) {
      alert('Select the weight of the stone.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // 1. 이미지 생성
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: selectedNumber
        }),
      });

      const data = await response.json();
      setResult(data);

      // 2. 이미지 생성 성공 시 자동으로 프린트 시작
      if (data.success && data.imageUrl) {
        console.log('✅ 이미지 생성 완료, 자동 프린트 시작...');
        setPrinting(true);

        try {
          const printPayload = {
            imageUrl: data.imageUrl,
            weight: selectedNumber,
            widthMm: printWidthMm,
            maintainAspectRatio: maintainAspectRatio,
            quality: printQuality,
            grayscale: grayscale,
          };

          const printServerUrl = process.env.NEXT_PUBLIC_PRINT_SERVER_URL || 'http://localhost:3001';
          const printResponse = await fetch(`${printServerUrl}/print`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(printPayload),
          });

          const printData = await printResponse.json();

          if (printData.success) {
            console.log('✅ 프린트 완료!');
          } else {
            console.error('❌ 프린트 실패:', printData.error);
          }
        } catch (printError) {
          console.error('❌ 프린트 오류:', printError);
        } finally {
          setPrinting(false);
        }
      }
    } catch (error) {
      setResult({
        success: false,
        error: 'Error occurred: ' + (error as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 마키 (왼쪽 이미지 갤러리) */}
      <div className="marquee-container">
        <div className="marquee-content">
          {/* 이미지를 두 번 반복하여 무한 스크롤 효과 */}
          {[...MARQUEE_IMAGES, ...MARQUEE_IMAGES].map((src, index) => (
            <img key={index} src={src} alt={`Sample ${(index % 17) + 1}`} />
          ))}
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="main-content">
        <h1>The exemplary posture of the operator Sisyphus</h1>

        <p>
          <span>
            1. Access the site via the QR code.<br />
            2. Select a stone weight from 1g to 10,000,000,000g.<br />
            3. Image generation takes time. Please wait approximately 30 seconds.<br />
            4. Appreciate the exemplary posture of Sisyphus, the worker effortlessly moving the stone.
          </span>
        </p>

        {/* 드롭다운과 버튼 */}
        <div className="form-row">
          <select
            value={selectedNumber}
            onChange={(e) => setSelectedNumber(e.target.value ? Number(e.target.value) : '')}
            disabled={loading}
          >
            <option value="" disabled>Select the weight of the stone.</option>
            {WEIGHT_OPTIONS.map((weight) => (
              <option key={weight} value={weight}>
                {weight.toLocaleString()}g
              </option>
            ))}
          </select>
          <button onClick={handleSubmit} disabled={loading || printing}>
            {loading ? 'Generating...' : printing ? 'Printing...' : 'Generate'}
          </button>
        </div>

        {/* 결과 표시 영역 */}
        {result && result.success && (
          <div className="result-area">
            <p style={{ fontWeight: 'bold' }}>Generated Prompt:</p>
            <p className="prompt-text">{result.prompt}</p>
            <p style={{ fontWeight: 'bold', marginTop: '20px' }}>Generated Image:</p>
            <img
              className="generated-image"
              src={result.imageUrl}
              alt="Generated Sisyphus"
            />
          </div>
        )}

        {result && !result.success && (
          <div className="result-area">
            <p style={{ color: 'red' }}>Error: {result.error}</p>
          </div>
        )}
      </div>
    </>
  );
}
