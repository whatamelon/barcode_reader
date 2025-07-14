import React, { useEffect, useRef, useState, useCallback } from 'react'
import { configure, DataCaptureView, DataCaptureContext, Camera, FrameSourceState } from '@scandit/web-datacapture-core'
import { barcodeCaptureLoader, BarcodeCapture, BarcodeCaptureSettings, Symbology, BarcodeCaptureOverlay } from '@scandit/web-datacapture-barcode'

interface ScanditBarcodeScannerProps {
	onDetected: (result: string) => void
	onError?: (error: string) => void
	isScanning?: boolean
}

const ScanditBarcodeScanner: React.FC<ScanditBarcodeScannerProps> = ({ onDetected, onError, isScanning: externalIsScanning = true }) => {
	const viewRef = useRef<HTMLDivElement>(null)
	const [isScanning, setIsScanning] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [isDetecting, setIsDetecting] = useState(false)
	const [isInitialized, setIsInitialized] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const isMountedRef = useRef(true)
	const [licenseKey, setLicenseKey] = useState<string>(
		'Am2muwaeIJhtQ22NvNEtzdgmeEXoDWiTFBOUk3wovL6+bSUEElatBapFvKs8bgZnMmDTSTVz8fyhc2scmHI0iw47eBCmI+jarkchypIBoASCN6Iuggwi684Mb9O0M6YRUXsTWzZeink4bdG6wFn3UMhWaPGSTOeHhGGbUZQWBhRTTGW8wEFvFvdEI0GCRgOr1kXJ7AARaYaTXRkHyWGgfYBAwZVNUi7PY3Kqznp7GHfjYfkQAlMrpC9cBUItb3ZnXE/eHhZWrmm3Xaxv71bYV4NvHJtwT2hCx3ldrZNYvfKfIfzlmnDDByhs4zHqSWVZUEFRyEFTp3p+Z2IxWFANs3NQpVbHcFFrknPSXCRR49G0R88PiS5hgKFMC3tRSK9oVlk3Ko1hoNWOUnsFxH3KEcF3SSR7eUZzE22OxoxEh7LOCSliJDEiSzxr6NeKZUhgnkYosHdFfI3/fd0IYmqf2FxLaGWyFK/3nUeYatRwgmH/e2ImrXpFK/ozBqZRfrvHEEHb2CRDS4VGYpHI/TzA7YNDpDaQ4bRwAOoObCgf+kYjyFH2pwcl5rX3N0dbuLOLSDxQgGJaIVTGRSMpe/8F8cUTE9RkjuNIUM+GxMruXQxSgpXsw6sLnDHeU2Qy2bqIPDBr+B4XZNrmfj/e2UdEkOk1HCfYmkZlcm+9JP2sE25NN2eB5qfSn3tNPIQRohkgTn7FcIzA4aGY4Qq9Z5jd6heXBRL+BTZEVwlxcR2srh8J/u3dX7tTpNk6VICSwcA1p61OagEnDZOCr1IoxUoirHz/9xFRngv2Z6O4ewPodB2k9M79TFNvXZDF4ypehhFlfsG26fZBJz2mI24q4Xrlpz0L4ygmvJTbLcxBs3MJgrxUMHMhAMhhccwWmWVSgUkWAPMag1zLebl/yIifZ9+7YMrjSNQM5aXlWg7otUVJap1E36C+t41v/JDpjEyyCqm3uyHCBz4LMFf1aOdZzosAkeqMdfsN6sJ6/X7SFI9wJh1qi2j1V+QFw/n479PfYW93ciYfg1EZCXWhBQNff7Hn0KL7dsLgTZKExeeQqlonSuHleSwWG0BFgmuqen9cC0CnAheeG1vRFkSGK388DjsFE0EbltOMwUd+X8Ajk8WRSlXtVjUynYv+yT78q0grrC/R2zj+zIrljye/ZMRcoiTzEjXCB+HQ15B8OhHEXgQ3trQ+8uXvjs7tQJjKhRHTdVdHRP4='
	)
	const [showLicenseInput, setShowLicenseInput] = useState(false)

	// Scandit 관련 refs
	const dataCaptureContextRef = useRef<DataCaptureContext | null>(null)
	const barcodeCaptureRef = useRef<BarcodeCapture | null>(null)
	const dataCaptureViewRef = useRef<DataCaptureView | null>(null)
	const overlayRef = useRef<BarcodeCaptureOverlay | null>(null)

	// 쿨타임 관련 상태
	const [isCooldown, setIsCooldown] = useState(false)
	const [cooldownLeft, setCooldownLeft] = useState(0)
	const cooldownSec = 2
	const cooldownTimer = useRef<NodeJS.Timeout | null>(null)

	// 외부에서 전달받은 isScanning 상태를 사용
	const currentIsScanning = externalIsScanning !== undefined ? externalIsScanning : isScanning

	// 리소스 정리 함수
	const cleanupResources = useCallback(async () => {
		if (!isMountedRef.current) return

		console.log('Scandit 리소스 정리 시작...')

		// 쿨타임 타이머 정리
		if (cooldownTimer.current) {
			clearInterval(cooldownTimer.current)
			cooldownTimer.current = null
		}

		// 바코드 캡처 비활성화
		if (barcodeCaptureRef.current) {
			try {
				await barcodeCaptureRef.current.setEnabled(false)
			} catch (e) {
				console.log('바코드 캡처 비활성화 중 오류:', e)
			}
			barcodeCaptureRef.current = null
		}

		// 카메라 중지
		if (dataCaptureContextRef.current && dataCaptureContextRef.current.frameSource) {
			try {
				await dataCaptureContextRef.current.frameSource.switchToDesiredState(FrameSourceState.Off)
			} catch (e) {
				console.log('카메라 중지 중 오류:', e)
			}
		}

		// 오버레이 정리
		if (overlayRef.current) {
			try {
				// 오버레이의 내부 리소스 정리
				overlayRef.current = null
			} catch (e) {
				console.log('오버레이 정리 중 오류:', e)
			}
		}

		// 뷰 정리
		if (dataCaptureViewRef.current) {
			try {
				// 뷰에서 DOM 요소 연결 해제
				dataCaptureViewRef.current = null
			} catch (e) {
				console.log('뷰 정리 중 오류:', e)
			}
		}

		// 컨텍스트 정리 (마지막에)
		if (dataCaptureContextRef.current) {
			try {
				await dataCaptureContextRef.current.dispose()
			} catch (e) {
				console.log('컨텍스트 정리 중 오류:', e)
			}
			dataCaptureContextRef.current = null
		}

		if (isMountedRef.current) {
			setIsInitialized(false)
			setIsScanning(false)
		}
		console.log('Scandit 리소스 정리 완료')
	}, [])

	// Scandit 초기화
	const initializeScandit = useCallback(async () => {
		if (!viewRef.current || isInitialized || !isMountedRef.current) return

		try {
			console.log('Scandit 초기화 시작...')
			if (isMountedRef.current) {
				setIsLoading(true)
			}

			// 기존 리소스 정리
			await cleanupResources()

			// 컴포넌트가 언마운트되었는지 확인
			if (!isMountedRef.current) return

			// 1. 라이브러리 설정 및 초기화 (한 번만 실행)
			if (!(window as any).scanditConfigured) {
				console.log('Scandit 라이브러리 설정 중...')

				// 라이센스 키가 없으면 입력 UI 표시
				if (!licenseKey || licenseKey === '-- ENTER YOUR SCANDIT LICENSE KEY HERE --') {
					setShowLicenseInput(true)
					setIsLoading(false)
					return
				}

				await configure({
					licenseKey: licenseKey,
					libraryLocation: 'https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7.4.0/sdc-lib/',
					moduleLoaders: [barcodeCaptureLoader()],
				})
				;(window as any).scanditConfigured = true
				console.log('Scandit 라이브러리 설정 완료')
			}

			// 컴포넌트가 언마운트되었는지 확인
			if (!isMountedRef.current) return

			// 2. DataCaptureContext 생성
			console.log('DataCaptureContext 생성 중...')
			dataCaptureContextRef.current = await DataCaptureContext.create()
			console.log('DataCaptureContext 생성 완료')

			// 컴포넌트가 언마운트되었는지 확인
			if (!isMountedRef.current) return

			// 3. 바코드 캡처 설정
			const settings = new BarcodeCaptureSettings()
			settings.enableSymbologies([Symbology.Code128, Symbology.Code93, Symbology.Code39, Symbology.QR, Symbology.EAN8, Symbology.UPCE, Symbology.EAN13UPCA])

			// 4. 바코드 캡처 생성
			barcodeCaptureRef.current = await BarcodeCapture.forContext(dataCaptureContextRef.current, settings)

			// 컴포넌트가 언마운트되었는지 확인
			if (!isMountedRef.current) return

			// 5. 바코드 캡처 리스너 설정
			barcodeCaptureRef.current.addListener({
				didScan: async (barcodeCapture: BarcodeCapture, session: any) => {
					if (isCooldown || !isMountedRef.current) return

					const barcode = session.newlyRecognizedBarcode
					if (barcode) {
						const code = barcode.data
						const symbology = barcode.symbology

						console.log('바코드 감지:', code, '형식:', symbology)

						// 감지 효과 표시
						if (isMountedRef.current) {
							setIsDetecting(true)
						}

						// 쿨타임 시작
						if (isMountedRef.current) {
							setIsCooldown(true)
							setCooldownLeft(cooldownSec)
						}
						if (cooldownTimer.current) clearInterval(cooldownTimer.current)
						cooldownTimer.current = setInterval(() => {
							if (!isMountedRef.current) {
								clearInterval(cooldownTimer.current as NodeJS.Timeout)
								return
							}
							setCooldownLeft((prev) => {
								if (prev <= 1) {
									clearInterval(cooldownTimer.current as NodeJS.Timeout)
									if (isMountedRef.current) {
										setIsCooldown(false)
										setIsDetecting(false)
									}
									return 0
								}
								return prev - 1
							})
						}, 1000)

						// 결과 전달
						onDetected(code)

						// 스캔 일시 중지
						await barcodeCapture.setEnabled(false)
					}
				},
			})

			// 컴포넌트가 언마운트되었는지 확인
			if (!isMountedRef.current) return

			// 6. 카메라 설정
			const cameraSettings = BarcodeCapture.recommendedCameraSettings
			const camera = Camera.default
			await camera.applySettings(cameraSettings)
			await dataCaptureContextRef.current.setFrameSource(camera)

			// 컴포넌트가 언마운트되었는지 확인
			if (!isMountedRef.current) return

			// 7. DataCaptureView 생성
			dataCaptureViewRef.current = await DataCaptureView.forContext(dataCaptureContextRef.current)
			dataCaptureViewRef.current.connectToElement(viewRef.current)

			// 컴포넌트가 언마운트되었는지 확인
			if (!isMountedRef.current) return

			// 8. 오버레이 추가 (ref로 관리, 에러 처리 강화)
			try {
				overlayRef.current = await BarcodeCaptureOverlay.withBarcodeCaptureForView(barcodeCaptureRef.current, dataCaptureViewRef.current)
				console.log('오버레이 생성 완료')
			} catch (overlayError: any) {
				console.warn('오버레이 생성 실패, 기본 모드로 진행:', overlayError)
				// 오버레이 없이도 스캔은 가능
				overlayRef.current = null
			}

			if (isMountedRef.current) {
				setIsInitialized(true)
				setIsLoading(false)
				setError(null)
			}
			console.log('Scandit 초기화 완료')
		} catch (err: any) {
			if (!isMountedRef.current) return

			console.error('Scandit 초기화 오류:', err)
			console.error('오류 상세 정보:', {
				name: err.name,
				message: err.message,
				stack: err.stack,
			})
			setIsLoading(false)
			let errorMessage = 'Scandit을 초기화할 수 없습니다.'

			if (err.message?.includes('license') || err.message?.includes('License')) {
				errorMessage = '유효하지 않은 Scandit 라이센스 키입니다. 라이센스 키를 확인해주세요.'
			} else if (err.message?.includes('camera')) {
				errorMessage = '카메라에 접근할 수 없습니다. 카메라 권한을 확인해주세요.'
			} else if (err.message?.includes('network')) {
				errorMessage = '네트워크 연결을 확인해주세요.'
			} else if (err.message?.includes('1025')) {
				errorMessage = '컨텍스트가 이미 해제되었습니다. 페이지를 새로고침해주세요.'
			} else if (err.message?.includes('HintPresenterV2') || err.message?.includes('already deleted')) {
				errorMessage = '스캐너 리소스가 이미 정리되었습니다. 페이지를 새로고침해주세요.'
			} else if (err.message?.includes('configure')) {
				errorMessage = 'Scandit 라이브러리 설정에 실패했습니다.'
			} else if (err.message?.includes('create')) {
				errorMessage = 'DataCaptureContext 생성에 실패했습니다.'
			}

			setError(errorMessage)
			onError?.(errorMessage)
		}
	}, [onDetected, onError, isCooldown, isInitialized, cleanupResources, licenseKey])

	// 스캐너 시작
	const startScanner = useCallback(async () => {
		if (!isInitialized || isCooldown) return

		try {
			if (barcodeCaptureRef.current && dataCaptureContextRef.current && dataCaptureContextRef.current.frameSource) {
				await barcodeCaptureRef.current.setEnabled(true)
				await dataCaptureContextRef.current.frameSource.switchToDesiredState(FrameSourceState.On)
				setIsScanning(true)
				console.log('Scandit 스캐너 시작...')
			}
		} catch (err) {
			console.error('스캐너 시작 오류:', err)
			setError('스캐너를 시작할 수 없습니다.')
		}
	}, [isInitialized, isCooldown])

	// 스캐너 중지
	const stopScanner = useCallback(async () => {
		try {
			if (barcodeCaptureRef.current) {
				await barcodeCaptureRef.current.setEnabled(false)
			}
			if (dataCaptureContextRef.current && dataCaptureContextRef.current.frameSource) {
				await dataCaptureContextRef.current.frameSource.switchToDesiredState(FrameSourceState.Off)
			}
			setIsScanning(false)
		} catch (error) {
			console.error('스캐너 중지 중 오류:', error)
		}
	}, [])

	// 쿨타임이 끝나면 자동으로 스캐너 재시작
	useEffect(() => {
		if (!isCooldown && currentIsScanning && !isDetecting && isInitialized) {
			startScanner()
		}
		return () => {
			if (cooldownTimer.current) clearInterval(cooldownTimer.current)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isCooldown, currentIsScanning, isInitialized])

	// 스캔 상태 변경 시 처리
	useEffect(() => {
		if (currentIsScanning && isInitialized) {
			startScanner()
		} else if (isInitialized) {
			stopScanner()
		}
	}, [currentIsScanning, isInitialized, startScanner, stopScanner])

	// 컴포넌트 마운트 시 초기화 (한 번만 실행)
	useEffect(() => {
		isMountedRef.current = true

		const init = async () => {
			if (isMountedRef.current) {
				await initializeScandit()
			}
		}

		init()

		// 컴포넌트 언마운트 시 정리
		return () => {
			isMountedRef.current = false
			cleanupResources()
		}
	}, []) // 의존성 배열을 비워서 한 번만 실행

	return (
		<div className="w-full">
			{/* 라이센스 키 입력 UI */}
			{showLicenseInput && (
				<div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
					<div className="text-center">
						<h3 className="text-lg font-semibold text-yellow-800 mb-2">Scandit 라이센스 키 필요</h3>
						<p className="text-sm text-yellow-700 mb-3">Scandit 바코드 스캐너를 사용하려면 라이센스 키가 필요합니다.</p>
						<div className="flex flex-col space-y-2">
							<input
								type="text"
								value={licenseKey}
								onChange={(e) => setLicenseKey(e.target.value)}
								placeholder="Scandit 라이센스 키를 입력하세요"
								className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
							<div className="flex space-x-2">
								<button
									onClick={() => {
										if (licenseKey.trim()) {
											setShowLicenseInput(false)
											setIsLoading(true)
											// 기존 설정 초기화
											;(window as any).scanditConfigured = false
											initializeScandit()
										}
									}}
									className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
								>
									라이센스 키 적용
								</button>
								<button
									onClick={() => {
										// 무료 테스트 키 사용
										setLicenseKey('-- ENTER YOUR SCANDIT LICENSE KEY HERE --')
										setShowLicenseInput(false)
										setError('무료 테스트 라이센스 키를 사용하려면 Scandit 웹사이트에서 발급받으세요.')
									}}
									className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
								>
									무료 키 안내
								</button>
							</div>
						</div>
						<div className="mt-3 text-xs text-yellow-600">
							💡 무료 테스트 라이센스는{' '}
							<a href="https://www.scandit.com/free-trial/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
								Scandit 웹사이트
							</a>
							에서 발급받을 수 있습니다.
						</div>
					</div>
				</div>
			)}

			<div className="relative">
				{/* Scandit 뷰어 */}
				<div className="w-full h-80 bg-gray-900 rounded-lg overflow-hidden relative">
					<div ref={viewRef} className="w-full h-full" />

					{/* 로딩 상태 */}
					{isLoading && (
						<div className="absolute inset-0 flex items-center justify-center bg-gray-800">
							<div className="text-center text-white">
								<div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-8 w-8 mb-4 animate-spin mx-auto"></div>
								<p className="text-sm">Scandit 라이브러리 로딩 중...</p>
							</div>
						</div>
					)}

					{error && (
						<div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-75">
							<div className="text-center text-white p-4">
								<div className="text-4xl mb-2">❌</div>
								<p className="text-sm">{error}</p>
								<button
									onClick={() => {
										setError(null)
										setShowLicenseInput(true)
									}}
									className="mt-2 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
								>
									라이센스 키 입력
								</button>
							</div>
						</div>
					)}

					{!isInitialized && !error && !isLoading && !showLicenseInput && (
						<div className="absolute inset-0 flex items-center justify-center bg-gray-800">
							<div className="text-center text-white">
								<div className="text-4xl mb-2">📷</div>
								<p className="text-sm">Scandit 초기화 중...</p>
							</div>
						</div>
					)}

					{!currentIsScanning && isInitialized && !error && !isLoading && !showLicenseInput && (
						<div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50">
							<div className="text-center text-white">
								<div className="text-4xl mb-2">⏸️</div>
								<p className="text-sm">스캔 일시중지</p>
							</div>
						</div>
					)}
				</div>

				{/* 스캔 가이드 오버레이 */}
				{currentIsScanning && !error && isInitialized && !isLoading && !showLicenseInput && (
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

						{/* 감지 효과 및 쿨타임 */}
						{isDetecting && (
							<div className="absolute inset-0 bg-green-500 bg-opacity-20 animate-pulse flex flex-col items-center justify-center">
								<div className="text-white text-2xl font-bold mb-2">✅ 감지됨!</div>
								{isCooldown && (
									<div className="flex flex-col items-center">
										<div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-8 w-8 mb-2 animate-spin"></div>
										<div className="text-white text-lg font-semibold">{cooldownLeft}초 후 다음 스캔</div>
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</div>

			{/* 상태 표시 */}
			<div className="mt-4 text-center">
				{currentIsScanning && !error && isInitialized && !isLoading && !showLicenseInput && (
					<div className="flex items-center justify-center space-x-2">
						<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
						<span className="text-sm text-gray-600">실시간 스캔 중...</span>
					</div>
				)}

				{error && <div className="text-sm text-red-600">{error}</div>}
			</div>

			{/* 지원 형식 표시 */}
			{!showLicenseInput && (
				<div className="mt-4 p-3 bg-blue-50 rounded-lg">
					<p className="text-sm text-blue-700 text-center mb-2">💡 Scandit 지원 형식: Code 128, Code 39, QR, EAN-8, UPC-E, EAN-13/UPC-A</p>
					<p className="text-xs text-blue-600 text-center">바코드를 스캔 영역 안에 위치시켜주세요</p>
				</div>
			)}
		</div>
	)
}

export default ScanditBarcodeScanner
