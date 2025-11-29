'use client';

import { useState } from 'react';

// 무게 옵션 (graduation과 동일: 1g ~ 10^10g)
const WEIGHT_OPTIONS = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000, 10000000000];

// 마키 이미지 (1~17)
const MARQUEE_IMAGES = Array.from({ length: 17 }, (_, i) => `/image/${i + 1}.png`);

export default function Home() {
  const [selectedNumber, setSelectedNumber] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [completedWeight, setCompletedWeight] = useState<number | null>(1); // TODO: 테스트 후 null로 변경

  // 인쇄 설정 (영수증 용지 71mm 폭)
  const printWidthMm = 71;
  const maintainAspectRatio = true;
  const printQuality = 90;
  const grayscale = true;

  // 초기 화면으로 리셋
  const resetToInitial = () => {
    setSelectedNumber('');
    setCompletedWeight(null);
  };

  const handleSubmit = async () => {
    if (!selectedNumber) {
      alert('Select the weight of the stone.');
      return;
    }

    const currentWeight = selectedNumber;
    setLoading(true);
    setCompletedWeight(null);

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

      // 2. 이미지 생성 성공 시 자동으로 프린트 시작
      if (data.success && data.imageUrl) {
        console.log('✅ 이미지 생성 완료, 자동 프린트 시작...');
        setLoading(false);
        setPrinting(true);

        try {
          const printPayload = {
            imageUrl: data.imageUrl,
            weight: currentWeight,
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
            // 프린트 완료 메시지 표시
            setCompletedWeight(currentWeight);
            // 5초 후 초기 화면으로 리셋
            setTimeout(() => {
              resetToInitial();
            }, 5000);
          } else {
            console.error('❌ 프린트 실패:', printData.error);
            alert('Print failed: ' + printData.error);
          }
        } catch (printError) {
          console.error('❌ 프린트 오류:', printError);
          alert('Print error occurred');
        } finally {
          setPrinting(false);
        }
      } else {
        // 이미지 생성 실패
        setLoading(false);
        alert('Image generation failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      setLoading(false);
      alert('Error occurred: ' + (error as Error).message);
    }
  };

  return (
    <>
      {/* 마키 (원본과 동일한 marquee 태그 사용) */}
      <marquee direction="up">
        {MARQUEE_IMAGES.map((src, index) => (
          <span key={index}>
            <img src={src} width="200" alt={`Sample ${index + 1}`} />
            <br />
          </span>
        ))}
      </marquee>

      <h1>The exemplary posture of the operator Sisyphus</h1>

      {/* 프린트 완료 시 결과 메시지, 아니면 설명 텍스트 */}
      {completedWeight !== null ? (
        <p className="completion-message">
          The pose of moving the {completedWeight.toLocaleString()}g stone lightly is completed.
        </p>
      ) : (
        <p>
          <span>
            1. Access the site via the QR code.<br />
            2. Select a stone weight from 1g to 10,000,000,000g.<br />
            3. Image generation takes time. Please wait approximately 30 seconds.<br />
            4. Appreciate the exemplary posture of Sisyphus, the worker effortlessly moving the stone.
          </span>
        </p>
      )}

      {/* 드롭다운과 버튼 */}
      <div className="form-row">
        <select
          value={selectedNumber}
          onChange={(e) => setSelectedNumber(e.target.value ? Number(e.target.value) : '')}
          disabled={loading || printing || completedWeight !== null}
        >
          <option value="" disabled>Select the weight of the stone.</option>
          {WEIGHT_OPTIONS.map((weight) => (
            <option key={weight} value={weight}>
              {weight.toLocaleString()}g
            </option>
          ))}
        </select>
        <button onClick={handleSubmit} disabled={loading || printing || completedWeight !== null}>
          {loading ? 'Generating...' : printing ? 'Printing...' : 'Generate'}
        </button>
      </div>
    </>
  );
}
