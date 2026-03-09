"use client"

import { useMemo, useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { 
  Loader2, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertTriangle, 
  Info,
  Upload,
  X,
  ZoomIn,
  Sparkles,
  RefreshCw,
  Shield,
  Activity
} from "lucide-react"

type PredictionResult = {
  id?: number
  timestamp?: string
  mode: "clinical_only" | "image_only" | "fusion"
  prediction: "Infected" | "Uninfected"
  confidence_score: number
  risk_level: "Low" | "Moderate" | "High"
  clinical_score?: number | null
  image_score?: number | null
  explanation?: {
    note?: string
    contributing_factors?: string[]
    grad_cam?: {
      attention_regions?: string[]
      confidence_in_visual?: number
    }
  }
  heatmap_path?: string | null
  heatmap_base64?: string | null
  computation_time?: number | null
  model_version?: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || "https://multimodal-malaria-prediction-system-3.onrender.com"

function joinUrl(base: string, path: string) {
  const b = base.endsWith("/") ? base.slice(0, -1) : base
  const p = path.startsWith("/") ? path : `/${path}`
  return `${b}${p}`
}

export default function ImagePredictionPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [result, setResult] = useState<PredictionResult | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const riskBadgeClasses = useMemo(() => {
    if (!result) return ""
    if (result.risk_level === "High")
      return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
    if (result.risk_level === "Moderate")
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
  }, [result])

  const handleFileChange = (f: File | null) => {
    setResult(null)
    setFile(f)

    if (!f) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      return
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const url = URL.createObjectURL(f)
    setPreviewUrl(url)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile && droppedFile.type.startsWith("image/")) {
      handleFileChange(droppedFile)
    } else {
      toast.error("Please drop a valid image file")
    }
  }

  const validateBeforeSubmit = () => {
    if (!file) {
      toast.error("Please select a microscopy image first.")
      return false
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Selected file is not an image.")
      return false
    }

    // Optional: Check file size (e.g., max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image size should be less than 10MB.")
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResult(null)

    if (!validateBeforeSubmit()) return

    setIsLoading(true)
    try {
      const form = new FormData()
      form.append("file", file as File)

      const res = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        body: form,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || "Image prediction failed")
      }

      const data: PredictionResult = await res.json()
      setResult(data)
      toast.success("Image prediction completed successfully!")
    } catch (err) {
      console.error("Image prediction error:", err)
      toast.error("Failed to predict from image. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const resetAll = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const heatmapSrc = useMemo(() => {
    if (!result) return null
    if (result.heatmap_base64) return `data:image/jpeg;base64,${result.heatmap_base64}`
    if (result.heatmap_path) return joinUrl(API_BASE, result.heatmap_path)
    return null
  }, [result])

  // Progress bar component
  const ProgressBar = ({ value, className = "" }: { value: number; className?: string }) => (
    <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
      <div 
        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
        style={{ width: `${value}%` }}
      />
    </div>
  )

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-blue-100 rounded-xl">
            <ImageIcon className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Image Prediction
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Upload a microscopy blood smear image for malaria diagnosis prediction
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Card */}
        <div className={result ? "lg:col-span-2" : "lg:col-span-3"}>
          <Card className="shadow-lg border-0">
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-cyan-50">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Upload className="h-5 w-5 text-blue-600" />
                Microscopy Image Upload
              </CardTitle>
              <CardDescription>
                Select a blood smear image. The system will generate a prediction and (when available) a Grad-CAM heatmap.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Dropzone */}
                <div
                  className={`
                    relative border-2 border-dashed rounded-xl p-8 transition-all
                    ${dragActive ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
                    ${previewUrl ? "bg-gray-50" : ""}
                  `}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    id="imageFile"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  
                  {!previewUrl ? (
                    <div className="text-center">
                      <div className="flex justify-center mb-4">
                        <div className="p-4 bg-blue-100 rounded-full">
                          <Upload className="h-8 w-8 text-blue-600" />
                        </div>
                      </div>
                      <p className="text-lg font-medium mb-2">Drop your image here</p>
                      <p className="text-sm text-gray-500 mb-4">or click to browse</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Select Image
                      </Button>
                      <p className="text-xs text-gray-400 mt-4">
                        Supported formats: JPG, PNG, JPEG (Max 10MB)
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span className="text-sm font-medium">{file?.name}</span>
                          <span className="text-xs text-gray-500">
                            ({(file?.size || 0) / 1024 / 1024 < 1 
                              ? `${((file?.size || 0) / 1024).toFixed(0)} KB` 
                              : `${((file?.size || 0) / 1024 / 1024).toFixed(1)} MB`})
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFileChange(null)}
                          className="text-gray-500 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="border rounded-lg p-4 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="Uploaded preview"
                          className="max-h-[300px] w-auto mx-auto rounded-md"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={resetAll} 
                    disabled={isLoading}
                    className="h-12 px-6"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>

                  <Button 
                    type="submit" 
                    disabled={isLoading || !file} 
                    size="lg"
                    className="h-12 px-8 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Predict from Image
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        {result && (
          <div className="lg:col-span-1">
            <Card className="shadow-lg border-0 sticky top-4">
              <CardHeader className={`border-b ${
                result.prediction === "Infected" 
                  ? "bg-gradient-to-r from-red-600 to-orange-600" 
                  : "bg-gradient-to-r from-emerald-600 to-green-600"
              } text-white rounded-t-lg`}>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {result.prediction === "Infected" ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                  Prediction Result
                </CardTitle>
                <CardDescription className="text-white/80">
                  {result.model_version || "v1.0"} • {result.mode?.replace("_", " ")}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-6 space-y-4">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-xs text-gray-500 mb-1">Outcome</div>
                    <div className={`text-lg font-bold ${
                      result.prediction === "Infected" ? "text-red-600" : "text-emerald-600"
                    }`}>
                      {result.prediction}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-xs text-gray-500 mb-1">Confidence</div>
                    <div className="text-lg font-bold text-blue-600">
                      {(result.confidence_score * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Risk Level */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">Risk Level</span>
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${riskBadgeClasses}`}>
                      {result.risk_level}
                    </span>
                  </div>
                  <ProgressBar value={result.confidence_score * 100} />
                  {result.computation_time && (
                    <div className="text-xs text-gray-400 mt-2">
                      Processing time: {result.computation_time.toFixed(3)}s
                    </div>
                  )}
                </div>

                {/* Image Score */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Image Score</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {typeof result.image_score === "number" 
                      ? `${(result.image_score * 100).toFixed(1)}%` 
                      : "N/A"}
                  </div>
                </div>

                {/* Grad-CAM Attention Regions */}
                {result.explanation?.grad_cam?.attention_regions && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-blue-600" />
                      Attention Regions
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {result.explanation.grad_cam.attention_regions.map((region, i) => (
                        <span
                          key={i}
                          className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-700"
                        >
                          {region}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Explanation Note */}
                {result.explanation?.note && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 flex gap-3">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium mb-1 text-blue-800">Explanation</div>
                      <p className="text-sm text-blue-700">{result.explanation.note}</p>
                    </div>
                  </div>
                )}

                {/* New Prediction Button */}
                <Button 
                  variant="outline" 
                  onClick={resetAll} 
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  New Prediction
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Heatmap Section - Full width when available */}
      {result && heatmapSrc && (
        <Card className="mt-6 border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
            <CardTitle className="flex items-center gap-2">
              <ZoomIn className="h-5 w-5 text-purple-600" />
              Grad-CAM Heatmap Analysis
            </CardTitle>
            <CardDescription>
              Visual explanation showing regions the model focused on for diagnosis
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Original Image */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Original Image</h4>
                <div className="border rounded-lg p-4 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl || ""}
                    alt="Original"
                    className="max-h-[400px] w-auto mx-auto rounded-md"
                  />
                </div>
              </div>

              {/* Heatmap */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Heatmap Overlay</h4>
                <div className="border rounded-lg p-4 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heatmapSrc}
                    alt="Grad-CAM heatmap"
                    className="max-h-[400px] w-auto mx-auto rounded-md"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700 flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                <span>
                  <span className="font-medium">Interpretation:</span> Red/yellow regions indicate areas the model 
                  focused on for its decision. Higher intensity suggests stronger influence on the prediction.
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="mt-6 border-0 bg-gradient-to-br from-blue-50 to-cyan-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white rounded-full shadow-sm">
              <Info className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">About Image Prediction</h3>
              <p className="text-gray-600 text-sm">
                This prediction uses a lightweight CNN (ShuffleNetV2) to analyze blood smear images. 
                When available, Grad-CAM highlights image regions that most influenced the model's decision, 
                supporting explainability in clinical workflows. The model is optimized for real-time inference 
                in low-resource settings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
