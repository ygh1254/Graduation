'use client';

import { useState } from 'react';
import Image from 'next/image';

interface GenerationResult {
  success: boolean;
  prompt?: string;
  imageUrl?: string;
  messageId?: string;
  error?: string;
}

export default function Home() {
  const [selectedNumber, setSelectedNumber] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);

  // 인쇄 설정 (71mm x 426mm @ 300 DPI)
  const [printWidth, setPrintWidth] = useState<number>(832); // 71mm = 832px @ 300 DPI
  const [maintainAspectRatio, setMaintainAspectRatio] = useState<boolean>(true);
  const [printQuality, setPrintQuality] = useState<number>(90);
  const [grayscale, setGrayscale] = useState<boolean>(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        console.log('📤 전송할 이미지 URL:', data.imageUrl);
        console.log('📤 전송할 무게:', selectedNumber);
        setPrinting(true);

        try {
          // Express 서버(포트 3001)로 프린트 요청
          const printPayload = {
            imageUrl: data.imageUrl,
            weight: selectedNumber,
            width: printWidth,
            maintainAspectRatio: maintainAspectRatio,
            quality: printQuality,
            grayscale: grayscale,
          };
          console.log('📦 프린트 요청 데이터:', printPayload);

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
        error: '오류가 발생했습니다: ' + (error as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-4">
      <div className="max-w-4xl mx-auto py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            건설 작업자 이미지 생성기
          </h1>
          <p className="text-lg text-gray-600">
            무게(1-100g)를 선택하면 작업자가 돌을 드는 3D 이미지를 생성합니다
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="number"
                className="block text-sm font-semibold text-gray-700 mb-3"
              >
                돌 무게 선택 (1g ~ 10^10g)
              </label>
              <select
                id="number"
                value={selectedNumber}
                onChange={(e) => setSelectedNumber(Number(e.target.value))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white text-lg"
                disabled={loading}
              >
                {[1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000, 10000000000].map((num) => (
                  <option key={num} value={num}>
                    {num.toLocaleString()}g
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-2">
                💡 무게에 따라 작업자의 동작이 달라집니다
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  이미지 생성 중...
                </span>
              ) : (
                '🏗️ 이미지 생성하기'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
