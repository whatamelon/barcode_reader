import React, { useEffect, useRef, useState, useCallback } from 'react'
import Quagga from 'quagga'

interface BarcodeScannerProps {
	onDetected: (result: string) => void
	onError?: (error: string) => void
	isScanning?: boolean
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onDetected, onError, isScanning: externalIsScanning }) => {
	const scannerRef = useRef<HTMLDivElement>(null)
	const [isScanning, setIsScanning] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [isDetecting, setIsDetecting] = useState(false)

	// 외부에서 전달받은 isScanning 상태를 사용
	const currentIsScanning = externalIsScanning !== undefined ? externalIsScanning : isScanning

	// 외부에서 isScanning이 제어되지 않는 경우에만 내부 상태 사용
	useEffect(() => {
		if (externalIsScanning === undefined) {
			setIsScanning(false)
		}
	}, [externalIsScanning])

	const startScanner = useCallback(() => {
		if (!scannerRef.current) {
			console.error('스캐너 요소를 찾을 수 없습니다.')
			return
		}

		console.log('스캐너 시작...')

		// 기존 Quagga 인스턴스 정리
		try {
			Quagga.stop()
		} catch (e) {
			// 이미 중지된 상태일 수 있음
		}

		// 이벤트 리스너들을 먼저 등록
		Quagga.onDetected((result) => {
			try {
				const code = result.codeResult.code
				console.log('바코드 감지:', code)

				// 감지 효과 표시
				setIsDetecting(true)

				// 잠시 후 결과 전달
				setTimeout(() => {
					onDetected(code)
					setIsDetecting(false)
				}, 500)

				// 성공적인 스캔 후 잠시 멈춤
				Quagga.pause()
				setTimeout(() => {
					if (currentIsScanning) {
						Quagga.start()
					}
				}, 2000)
			} catch (e) {
				console.error('바코드 감지 처리 중 오류:', e)
			}
		})

		Quagga.onProcessed((result) => {
			try {
				const drawingCanvas = Quagga.canvas.dom.overlay
				const drawingCtx = drawingCanvas.getContext('2d')

				if (result && drawingCtx) {
					if (result.boxes) {
						const width = drawingCanvas.getAttribute('width')
						const height = drawingCanvas.getAttribute('height')

						if (width && height) {
							drawingCtx.clearRect(0, 0, parseInt(width), parseInt(height))
							result.boxes
								.filter((box) => box !== result.box)
								.forEach((box) => {
									Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, { color: 'green', lineWidth: 2 })
								})
						}
					}

					if (result.box) {
						Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: 'blue', lineWidth: 2 })
					}

					if (result.codeResult && result.codeResult.code) {
						Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, { color: 'red', lineWidth: 3 })
					}
				}
			} catch (e) {
				console.error('이미지 처리 중 오류:', e)
			}
		})

		// Quagga 초기화
		Quagga.init(
			{
				inputStream: {
					name: 'Live',
					type: 'LiveStream',
					target: scannerRef.current,
					constraints: {
						width: { min: 640, ideal: 1280, max: 1920 },
						height: { min: 480, ideal: 720, max: 1080 },
						facingMode: 'environment', // 후면 카메라 사용
						aspectRatio: { min: 1, max: 2 },
					},
				},
				decoder: {
					readers: ['code_93_reader'],
				},
				locate: true,
			},
			(err) => {
				if (err) {
					console.error('Quagga 초기화 오류:', err)

					// 더 구체적인 에러 메시지 제공
					let errorMessage = '카메라를 초기화할 수 없습니다.'

					if (err.name === 'NotAllowedError') {
						errorMessage = '카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.'
					} else if (err.name === 'NotFoundError') {
						errorMessage = '카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.'
					} else if (err.name === 'NotReadableError') {
						errorMessage = '카메라에 접근할 수 없습니다. 다른 앱에서 카메라를 사용 중인지 확인해주세요.'
					} else if (err.name === 'OverconstrainedError') {
						errorMessage = '지원되지 않는 카메라 설정입니다.'
					}

					setError(errorMessage)
					onError?.(errorMessage)
					return
				}

				console.log('Quagga 초기화 성공')
				Quagga.start()
			}
		)
	}, [onDetected, currentIsScanning, onError])

	const stopScanner = useCallback(() => {
		try {
			Quagga.stop()
		} catch (error) {
			console.error('스캐너 중지 중 오류:', error)
		}
	}, [])

	useEffect(() => {
		if (currentIsScanning) {
			startScanner()
		} else {
			stopScanner()
		}

		return () => {
			stopScanner()
		}
	}, [currentIsScanning, startScanner, stopScanner])

	return (
		<div className="w-full">
			<div className="relative">
				{/* 카메라 뷰어 */}
				<div ref={scannerRef} className="w-full h-80 bg-gray-900 rounded-lg overflow-hidden relative">
					{error && (
						<div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-75">
							<div className="text-center text-white p-4">
								<div className="text-4xl mb-2">❌</div>
								<p className="text-sm">{error}</p>
								<button
									onClick={() => {
										setError(null)
										if (currentIsScanning) {
											startScanner()
										}
									}}
									className="mt-2 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
								>
									다시 시도
								</button>
							</div>
						</div>
					)}

					{!currentIsScanning && !error && (
						<div className="absolute inset-0 flex items-center justify-center bg-gray-800">
							<div className="text-center text-white">
								<div className="text-4xl mb-2">📷</div>
								<p className="text-sm">카메라 초기화 중...</p>
							</div>
						</div>
					)}
				</div>

				{/* 스캔 가이드 오버레이 */}
				{currentIsScanning && !error && (
					<div className="absolute inset-0 pointer-events-none">
						{/* 스캔 영역 표시 */}
						<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-40 border-2 border-blue-400 rounded-lg">
							{/* 코너 마커 */}
							<div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-blue-400"></div>
							<div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-blue-400"></div>
							<div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-blue-400"></div>
							<div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-blue-400"></div>

							{/* 스캔 라인 애니메이션 */}
							<div className="absolute inset-0 overflow-hidden">
								<div className="absolute top-0 left-0 w-full h-0.5 bg-blue-400 animate-pulse"></div>
							</div>
						</div>

						{/* 감지 효과 */}
						{isDetecting && (
							<div className="absolute inset-0 bg-green-500 bg-opacity-20 animate-pulse flex items-center justify-center">
								<div className="text-white text-2xl font-bold">✅ 감지됨!</div>
							</div>
						)}
					</div>
				)}
			</div>

			{/* 상태 표시 */}
			<div className="mt-4 text-center">
				{currentIsScanning && !error && (
					<div className="flex items-center justify-center space-x-2">
						<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
						<span className="text-sm text-gray-600">실시간 스캔 중...</span>
					</div>
				)}

				{error && <div className="text-sm text-red-600">카메라 접근 권한이 필요합니다</div>}
			</div>

			{/* 사용법 안내 */}
			<div className="mt-4 p-3 bg-blue-50 rounded-lg">
				<p className="text-sm text-blue-700 text-center">💡 바코드를 스캔 영역 안에 위치시켜주세요</p>
			</div>
		</div>
	)
}

export default BarcodeScanner
