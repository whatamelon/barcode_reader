import React, { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader, Result, BarcodeFormat } from '@zxing/library'

interface ZXingBarcodeScannerProps {
	onDetected: (result: string) => void
	onError?: (error: string) => void
	isScanning?: boolean
	formats?: BarcodeFormat[]
	videoConstraints?: MediaTrackConstraints
}

const ZXingBarcodeScanner: React.FC<ZXingBarcodeScannerProps> = ({
	onDetected,
	onError,
	isScanning: externalIsScanning = true,
	formats = [
		BarcodeFormat.QR_CODE,
		BarcodeFormat.CODE_128,
		BarcodeFormat.CODE_39,
		BarcodeFormat.EAN_13,
		BarcodeFormat.EAN_8,
		BarcodeFormat.UPC_A,
		BarcodeFormat.UPC_E,
		BarcodeFormat.CODE_93,
		BarcodeFormat.ITF,
		BarcodeFormat.CODABAR,
	],
	videoConstraints = {
		width: { min: 640, ideal: 1280, max: 1920 },
		height: { min: 480, ideal: 720, max: 1080 },
		facingMode: 'environment',
	},
}) => {
	const videoRef = useRef<HTMLVideoElement>(null)
	const [isScanning, setIsScanning] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [isDetecting, setIsDetecting] = useState(false)
	const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([])
	const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
	const readerRef = useRef<BrowserMultiFormatReader | null>(null)

	// 쿨타임 관련 상태
	const [isCooldown, setIsCooldown] = useState(false)
	const [cooldownLeft, setCooldownLeft] = useState(0)
	const cooldownSec = 2
	const cooldownTimer = useRef<NodeJS.Timeout | null>(null)

	// 외부에서 전달받은 isScanning 상태를 사용
	const currentIsScanning = externalIsScanning !== undefined ? externalIsScanning : isScanning

	// 사용 가능한 카메라 장치 목록 가져오기
	const getAvailableDevices = useCallback(async () => {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices()
			const videoDevices = devices.filter((device) => device.kind === 'videoinput')
			setAvailableDevices(videoDevices)

			// 기본적으로 첫 번째 장치 선택
			if (videoDevices.length > 0 && !selectedDeviceId) {
				setSelectedDeviceId(videoDevices[0].deviceId)
			}
		} catch (err) {
			console.error('카메라 장치 목록을 가져올 수 없습니다:', err)
		}
	}, [selectedDeviceId])

	// 스캐너 시작
	const startScanner = useCallback(async () => {
		if (!videoRef.current) {
			console.error('비디오 요소를 찾을 수 없습니다.')
			return
		}

		if (isCooldown) return // 쿨타임 중에는 스캔 시작 금지

		try {
			// 기존 리더 정리
			if (readerRef.current) {
				readerRef.current.reset()
			}

			// 새로운 리더 생성
			readerRef.current = new BrowserMultiFormatReader()

			console.log('ZXing 스캐너 시작...')

			readerRef.current.decodeFromConstraints(
				{
					video: {
						...videoConstraints,
						deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
					},
				},
				videoRef.current,
				(result: Result | null) => {
					if (result && !isCooldown) {
						const code = result.getText()
						console.log('바코드 감지:', code, '형식:', result.getBarcodeFormat())

						// 감지 효과 표시
						setIsDetecting(true)

						// 쿨타임 시작
						setIsCooldown(true)
						setCooldownLeft(cooldownSec)
						if (cooldownTimer.current) clearInterval(cooldownTimer.current)
						cooldownTimer.current = setInterval(() => {
							setCooldownLeft((prev) => {
								if (prev <= 1) {
									clearInterval(cooldownTimer.current as NodeJS.Timeout)
									setIsCooldown(false)
									setIsDetecting(false)
									return 0
								}
								return prev - 1
							})
						}, 1000)

						// 결과 전달
						onDetected(code)

						// 스캔 완전 중지
						if (readerRef.current) {
							readerRef.current.reset()
							readerRef.current = null
						}
					}
					// 에러는 별도로 처리하지 않음 (NotFoundException은 정상적인 상황)
				}
			)

			setError(null)
			setIsScanning(true)
		} catch (err: any) {
			console.error('스캐너 시작 오류:', err)

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
			} else if (err.name === 'NotSupportedError') {
				errorMessage = '이 브라우저는 카메라 접근을 지원하지 않습니다.'
			}

			setError(errorMessage)
			onError?.(errorMessage)
		}
	}, [onDetected, currentIsScanning, onError, videoConstraints, selectedDeviceId, isCooldown])

	// 스캐너 중지
	const stopScanner = useCallback(() => {
		try {
			if (readerRef.current) {
				readerRef.current.reset()
			}
			if (videoRef.current && videoRef.current.srcObject) {
				const stream = videoRef.current.srcObject as MediaStream
				stream.getTracks().forEach((track) => track.stop())
				videoRef.current.srcObject = null
			}
			setIsScanning(false)
		} catch (error) {
			console.error('스캐너 중지 중 오류:', error)
		}
	}, [])

	// 카메라 장치 변경
	const handleDeviceChange = useCallback(
		(deviceId: string) => {
			setSelectedDeviceId(deviceId)
			if (currentIsScanning) {
				stopScanner()
				setTimeout(() => startScanner(), 100)
			}
		},
		[currentIsScanning, stopScanner, startScanner]
	)

	// 컴포넌트 마운트 시 카메라 장치 목록 가져오기
	useEffect(() => {
		getAvailableDevices()
	}, [getAvailableDevices])

	// 스캔 상태 변경 시 처리
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

	// 쿨타임이 끝나면 자동으로 스캐너 재시작
	useEffect(() => {
		if (!isCooldown && currentIsScanning && !isDetecting && !readerRef.current) {
			startScanner()
		}
		return () => {
			if (cooldownTimer.current) clearInterval(cooldownTimer.current)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isCooldown, currentIsScanning])

	return (
		<div className="w-full">
			<div className="relative">
				{/* 카메라 선택 드롭다운 */}
				{availableDevices.length > 1 && (
					<div className="mb-4">
						<label htmlFor="camera-select" className="block text-sm font-medium text-gray-700 mb-2">
							카메라 선택:
						</label>
						<select
							id="camera-select"
							value={selectedDeviceId}
							onChange={(e) => handleDeviceChange(e.target.value)}
							className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
						>
							{availableDevices.map((device) => (
								<option key={device.deviceId} value={device.deviceId}>
									{device.label || `카메라 ${device.deviceId.slice(0, 8)}...`}
								</option>
							))}
						</select>
					</div>
				)}

				{/* 비디오 뷰어 */}
				<div className="w-full h-80 bg-gray-900 rounded-lg overflow-hidden relative">
					<video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />

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
				{currentIsScanning && !error && (
					<div className="flex items-center justify-center space-x-2">
						<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
						<span className="text-sm text-gray-600">실시간 스캔 중...</span>
					</div>
				)}

				{error && <div className="text-sm text-red-600">카메라 접근 권한이 필요합니다</div>}
			</div>

			{/* 지원 형식 표시 */}
			<div className="mt-4 p-3 bg-blue-50 rounded-lg">
				<p className="text-sm text-blue-700 text-center mb-2">💡 지원 형식: QR, Code 128, Code 39, EAN-13, EAN-8, UPC-A, UPC-E, Code 93, ITF, Codabar</p>
				<p className="text-xs text-blue-600 text-center">바코드를 스캔 영역 안에 위치시켜주세요</p>
			</div>
		</div>
	)
}

export default ZXingBarcodeScanner
