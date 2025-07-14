import React, { useState } from 'react'
import './App.css'
import BarcodeScanner from './components/BarcodeScanner'
import ZXingBarcodeScanner from './components/ZXingBarcodeScanner'
import ScanditBarcodeScanner from './components/ScanditBarcodeScanner'

interface ScannedListType {
	index: number
	code: string
	date: string
}

function App() {
	const [scannedCodes, setScannedCodes] = useState<ScannedListType[]>([])
	const [lastScanned, setLastScanned] = useState<string | null>(null)
	const [showScanner, setShowScanner] = useState(false)
	const [isScanning, setIsScanning] = useState(false)
	const [selectedScanner, setSelectedScanner] = useState<'quagga' | 'zxing' | 'scandit'>('zxing')

	const handleBarcodeDetected = (code: string) => {
		console.log('바코드 감지됨:', code)
		setLastScanned(code)
		setScannedCodes((prev) => [...prev, { index: prev.length + 1, code: code, date: new Date().toLocaleString() }]) // 최대 10개만 유지

		// 스캔 성공 시 스캐너 숨기기
		setTimeout(() => {
			setShowScanner(false)
			setIsScanning(false)
		}, 1500)
	}

	const handleError = (error: string) => {
		console.error('스캐너 오류:', error)
	}

	const clearHistory = () => {
		setScannedCodes([])
		setLastScanned(null)
	}

	const startScanning = () => {
		setShowScanner(true)
		setIsScanning(true)
	}

	const stopScanning = () => {
		setShowScanner(false)
		setIsScanning(false)
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
			{/* 헤더 */}
			<div className="bg-white shadow-sm border-b">
				<div className="max-w-4xl mx-auto px-4 py-6">
					<div className="text-center">
						<h1 className="text-4xl font-bold text-gray-800 mb-2">📱 바코드 스캐너</h1>
						<p className="text-gray-600 text-lg">모바일 카메라로 바코드를 실시간으로 스캔하세요</p>
					</div>
				</div>
			</div>

			<div className="max-w-4xl mx-auto px-4 py-8">
				{/* 메인 컨텐츠 */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					{/* 왼쪽: 스캔 섹션 */}
					<div className="space-y-6">
						{/* 스캐너 선택 */}
						<div className="bg-white rounded-xl shadow-lg p-6">
							<div className="text-center mb-6">
								<div className="text-6xl mb-4">📷</div>
								<h2 className="text-2xl font-bold text-gray-800 mb-4">바코드 스캐너 선택</h2>
								<p className="text-gray-600 mb-6">사용할 스캐너를 선택하고 바코드를 스캔하세요</p>
							</div>

							{/* 스캐너 선택 버튼 */}
							<div className="grid grid-cols-3 gap-4 mb-6">
								<button
									onClick={() => setSelectedScanner('zxing')}
									className={`p-4 rounded-lg border-2 transition-all ${
										selectedScanner === 'zxing' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
									}`}
								>
									<div className="text-2xl mb-2">🔍</div>
									<div className="font-semibold">ZXing 스캐너</div>
									<div className="text-xs mt-1">QR, Code 128, EAN 등</div>
								</button>
								<button
									onClick={() => setSelectedScanner('quagga')}
									className={`p-4 rounded-lg border-2 transition-all ${
										selectedScanner === 'quagga' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
									}`}
								>
									<div className="text-2xl mb-2">📱</div>
									<div className="font-semibold">Quagga 스캐너</div>
									<div className="text-xs mt-1">Code 93 등</div>
								</button>
								<button
									onClick={() => setSelectedScanner('scandit')}
									className={`p-4 rounded-lg border-2 transition-all ${
										selectedScanner === 'scandit' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
									}`}
								>
									<div className="text-2xl mb-2">⚡</div>
									<div className="font-semibold">Scandit 스캐너</div>
									<div className="text-xs mt-1">고성능 스캔</div>
								</button>
							</div>

							{/* 스캔 버튼 */}
							<div className="text-center">
								{!showScanner ? (
									<button
										onClick={startScanning}
										className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
									>
										🚀 {selectedScanner === 'zxing' ? 'ZXing' : selectedScanner === 'quagga' ? 'Quagga' : 'Scandit'} 스캔 시작하기
									</button>
								) : (
									<button
										onClick={stopScanning}
										className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
									>
										⏹️ 스캔 중지하기
									</button>
								)}
							</div>
						</div>

						{/* 스캐너 */}
						{showScanner && (
							<div className="bg-white rounded-xl shadow-lg p-6">
								{selectedScanner === 'zxing' ? (
									<ZXingBarcodeScanner onDetected={handleBarcodeDetected} onError={handleError} isScanning={isScanning} />
								) : selectedScanner === 'quagga' ? (
									<BarcodeScanner onDetected={handleBarcodeDetected} onError={handleError} isScanning={isScanning} />
								) : (
									<ScanditBarcodeScanner onDetected={handleBarcodeDetected} onError={handleError} isScanning={isScanning} />
								)}
							</div>
						)}
					</div>

					{/* 오른쪽: 결과 섹션 */}
					<div className="space-y-6">
						{/* 최근 스캔 결과 */}
						{lastScanned && (
							<div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
								<div className="flex items-center mb-4">
									<div className="text-2xl mr-3">✅</div>
									<h3 className="text-xl font-bold text-gray-800">최근 스캔 결과</h3>
								</div>
								<div className="bg-green-50 rounded-lg p-4">
									<p className="font-mono text-lg text-green-800 break-all font-bold">{lastScanned}</p>
									<p className="text-sm text-green-600 mt-2">{new Date().toLocaleString()}</p>
								</div>
							</div>
						)}

						{/* 스캔 기록 */}
						{scannedCodes.length > 0 && (
							<div className="bg-white rounded-xl shadow-lg p-6">
								<div className="flex justify-between items-center mb-4">
									<div className="flex items-center">
										<div className="text-2xl mr-3">📋</div>
										<h3 className="text-xl font-bold text-gray-800">스캔 기록</h3>
										<span className="ml-2 bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded-full">{scannedCodes.length}</span>
									</div>
									<button onClick={clearHistory} className="text-sm text-red-500 hover:text-red-700 font-medium">
										🗑️ 기록 삭제
									</button>
								</div>

								<div className="space-y-3 max-h-96 overflow-y-auto">
									{scannedCodes.map((code, index) => (
										<div key={index} className="p-4 bg-gray-50 rounded-lg border-l-4 border-blue-500 hover:bg-gray-100 transition-colors">
											<div className="flex justify-between items-start">
												<div className="flex-1">
													<p className="font-mono text-sm text-gray-700 break-all font-medium">{code.code}</p>
													<p className="text-xs text-gray-500 mt-1">{code.date}</p>
												</div>
												<div className="text-xs text-gray-400 ml-2">#{code.index}</div>
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{/* 정보 카드 */}
						<div className="bg-white rounded-xl shadow-lg p-6">
							<div className="flex items-center mb-4">
								<div className="text-2xl mr-3">ℹ️</div>
								<h3 className="text-xl font-bold text-gray-800">지원 형식</h3>
							</div>
							<div className="grid grid-cols-2 gap-2 text-sm">
								<div className="flex items-center">
									<span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
									QR Code
								</div>
								<div className="flex items-center">
									<span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
									Code 128
								</div>
								<div className="flex items-center">
									<span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
									EAN-13
								</div>
								<div className="flex items-center">
									<span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
									UPC-A
								</div>
								<div className="flex items-center">
									<span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
									Code 39
								</div>
								<div className="flex items-center">
									<span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
									Code 93
								</div>
							</div>
							<div className="mt-4 p-3 bg-blue-50 rounded-lg">
								<p className="text-sm text-blue-700">💡 모바일 브라우저에서 최적의 성능을 제공합니다</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default App
