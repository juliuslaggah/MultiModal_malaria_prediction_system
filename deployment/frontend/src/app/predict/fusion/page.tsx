"use client"

import { useMemo, useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Loader2, 
  Info,
  Upload,
  X,
  ZoomIn,
  Sparkles,
  RefreshCw,
  Shield,
  Activity,
  User,
  Thermometer,
  Brain,
  Heart,
  Bone,
  Wind,
  AlertCircle
} from "lucide-react"

type ClinicalFormState = {
  Age: string
  Sex: "Female" | "Male"
  Fever: boolean
  Headache: boolean
  Abdominal_Pain: boolean
  General_Body_Malaise: boolean
  Dizziness: boolean
  Vomiting: boolean
  Confusion: boolean
  Backache: boolean
  Chest_Pain: boolean
  Coughing: boolean
  Joint_Pain: boolean
}

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
    clinical_scores?: {
      malaria_score: number
      respiratory_score: number
      gi_score: number
    }
    fusion_alpha?: number
    clinical_weight?: number
    image_weight?: number
  }
  heatmap_path?: string | null
  heatmap_base64?: string | null
  computation_time?: number | null
  model_version?: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://127.0.0.1:8000"

function joinUrl(base: string, path: string) {
  const b = base.endsWith("/") ? base.slice(0, -1) : base
  const p = path.startsWith("/") ? path : `/${path}`
  return `${b}${p}`
}

export default function FusionPredictionPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<PredictionResult | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState<ClinicalFormState>({
    Age: "",
    Sex: "Female",
    Fever: false,
    Headache: false,
    Abdominal_Pain: false,
    General_Body_Malaise: false,
    Dizziness: false,
    Vomiting: false,
    Confusion: false,
    Backache: false,
    Chest_Pain: false,
    Coughing: false,
    Joint_Pain: false,
  })

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const selectedSymptomsCount = useMemo(() => {
    let count = 0
    if (formData.Fever) count++
    if (formData.Headache) count++
    if (formData.Abdominal_Pain) count++
    if (formData.General_Body_Malaise) count++
    if (formData.Dizziness) count++
    if (formData.Vomiting) count++
    if (formData.Confusion) count++
    if (formData.Backache) count++
    if (formData.Chest_Pain) count++
    if (formData.Coughing) count++
    if (formData.Joint_Pain) count++
    return count
  }, [formData])

  const riskBadgeClasses = useMemo(() => {
    if (!result) return ""
    if (result.risk_level === "High") return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
    if (result.risk_level === "Moderate")
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
  }, [result])

  const handleInputChange = (field: keyof ClinicalFormState, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

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
    const ageNum = Number(formData.Age)
    if (!Number.isFinite(ageNum) || formData.Age.trim() === "") {
      toast.error("Please enter a valid age.")
      return false
    }
    if (ageNum < 0 || ageNum > 120) {
      toast.error("Age must be between 0 and 120.")
      return false
    }
    if (!file) {
      toast.error("Please upload a microscopy image.")
      return false
    }
    if (selectedSymptomsCount < 3) {
      toast.error(`Please select at least 3 symptoms. Currently selected: ${selectedSymptomsCount}`)
      return false
    }
    return true
  }

  const resetAll = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFormData({
      Age: "",
      Sex: "Female",
      Fever: false,
      Headache: false,
      Abdominal_Pain: false,
      General_Body_Malaise: false,
      Dizziness: false,
      Vomiting: false,
      Confusion: false,
      Backache: false,
      Chest_Pain: false,
      Coughing: false,
      Joint_Pain: false,
    })
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

  const renderTopFactors = () => {
    const top = result?.explanation?.contributing_factors
    if (!top || !Array.isArray(top) || top.length === 0) return null

    return (
      <div className="mt-4">
        <div className="text-sm font-medium mb-2 flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-600" />
          Top Contributing Factors
        </div>
        <div className="flex flex-wrap gap-2">
          {top.slice(0, 5).map((t: string, idx: number) => (
            <span
              key={`${t}-${idx}`}
              className="text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 font-medium"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    )
  }

  const renderClinicalScores = () => {
    const scores = result?.explanation?.clinical_scores
    if (!scores) return null

    return (
      <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-600" />
          Clinical Syndrome Analysis
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">Malaria</div>
            <div className="text-xl font-bold text-blue-600">{scores.malaria_score}</div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div 
                className="bg-blue-600 h-1.5 rounded-full" 
                style={{ width: `${Math.min(100, scores.malaria_score)}%` }}
              />
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">Respiratory</div>
            <div className="text-xl font-bold text-green-600">{scores.respiratory_score}</div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div 
                className="bg-green-600 h-1.5 rounded-full" 
                style={{ width: `${Math.min(100, scores.respiratory_score)}%` }}
              />
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">GI</div>
            <div className="text-xl font-bold text-orange-600">{scores.gi_score}</div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div 
                className="bg-orange-600 h-1.5 rounded-full" 
                style={{ width: `${Math.min(100, scores.gi_score)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderHumanInterpretation = () => {
    if (!result) return null
    const isInfected = result.prediction === "Infected"
    const risk = result.risk_level

    const headline = isInfected
      ? `Fusion model suggests malaria infection (${risk} risk).`
      : `Fusion model suggests no malaria infection (${risk} risk).`

    const nextSteps = isInfected
      ? [
          "Consider confirmatory testing (e.g., microscopy or RDT) where available.",
          "If symptoms are severe or worsening, seek clinical evaluation immediately.",
          "Follow local clinical guidelines for treatment decisions.",
        ]
      : [
          "If symptoms persist, consider alternative diagnoses and follow-up evaluation.",
          "Repeat testing may be needed if symptoms continue or exposure risk is high.",
        ]

    return (
      <div className="mt-4 p-4 bg-white dark:bg-gray-900 rounded-lg border">
        <div className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-600" />
          Clinical interpretation
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">{headline}</p>

        <div className="mt-3">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Suggested next steps</div>
          <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc pl-5 space-y-1">
            {nextSteps.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        </div>

        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          This tool is a decision-support system and does not replace professional medical advice.
        </p>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResult(null)
    if (!validateBeforeSubmit()) return

    setIsLoading(true)
    try {
      const clinicalData = {
        Age: parseInt(formData.Age, 10),
        Sex: formData.Sex,
        Fever: formData.Fever ? 1 : 0,
        Headache: formData.Headache ? 1 : 0,
        Abdominal_Pain: formData.Abdominal_Pain ? 1 : 0,
        General_Body_Malaise: formData.General_Body_Malaise ? 1 : 0,
        Dizziness: formData.Dizziness ? 1 : 0,
        Vomiting: formData.Vomiting ? 1 : 0,
        Confusion: formData.Confusion ? 1 : 0,
        Backache: formData.Backache ? 1 : 0,
        Chest_Pain: formData.Chest_Pain ? 1 : 0,
        Coughing: formData.Coughing ? 1 : 0,
        Joint_Pain: formData.Joint_Pain ? 1 : 0,
      }

      const fd = new FormData()
      fd.append("clinical_data", JSON.stringify(clinicalData))
      fd.append("file", file as File)

      const res = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        body: fd,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || "Fusion prediction failed")
      }

      const data: PredictionResult = await res.json()
      setResult(data)
      toast.success("Fusion prediction completed successfully!")
    } catch (err) {
      console.error(err)
      toast.error("Fusion prediction failed. Check backend logs.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-purple-100 rounded-xl">
            <Layers className="h-8 w-8 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Fusion Prediction
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Upload microscopy image + enter symptoms for late-fusion malaria diagnosis
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Form */}
        <div className={result ? "lg:col-span-2" : "lg:col-span-3"}>
          <Card className="shadow-lg border-0">
            <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Upload className="h-5 w-5 text-purple-600" />
                Fusion Input
              </CardTitle>
              <CardDescription>
                Provide both clinical symptoms and microscopy image. The system will return a fusion diagnosis and Grad-CAM heatmap.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Image upload with drag & drop */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Microscopy Image</Label>
                  <div
                    className={`
                      relative border-2 border-dashed rounded-xl p-6 transition-all
                      ${dragActive ? "border-purple-400 bg-purple-50" : "border-gray-300 hover:border-gray-400"}
                      ${previewUrl ? "bg-gray-50" : ""}
                    `}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    
                    {!previewUrl ? (
                      <div className="text-center">
                        <div className="flex justify-center mb-3">
                          <div className="p-3 bg-purple-100 rounded-full">
                            <Upload className="h-6 w-6 text-purple-600" />
                          </div>
                        </div>
                        <p className="text-sm font-medium mb-1">Drop your image here</p>
                        <p className="text-xs text-gray-500 mb-3">or click to browse</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Select Image
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium">{file?.name}</span>
                            <span className="text-xs text-gray-500">
                              {((file?.size || 0) / 1024).toFixed(0)} KB
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
                        <div className="border rounded-lg p-2 bg-white">
                          <img
                            src={previewUrl || ""}
                            alt="Selected microscopy"
                            className="max-h-[200px] w-auto mx-auto rounded-md"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Demographics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="age" className="text-sm font-medium">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      min="0"
                      max="120"
                      required
                      value={formData.Age}
                      onChange={(e) => handleInputChange("Age", e.target.value)}
                      placeholder="Enter patient age"
                      className="h-12"
                    />
                  </div>

                  {/* Gender Selection */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Gender</Label>
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                        {selectedSymptomsCount}/11 symptoms
                      </span>
                    </div>

                    <div className="flex space-x-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="female"
                          name="gender"
                          value="Female"
                          checked={formData.Sex === "Female"}
                          onChange={(e) => handleInputChange("Sex", e.target.value)}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                        />
                        <Label htmlFor="female" className="text-sm">Female</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="male"
                          name="gender"
                          value="Male"
                          checked={formData.Sex === "Male"}
                          onChange={(e) => handleInputChange("Sex", e.target.value)}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                        />
                        <Label htmlFor="male" className="text-sm">Male</Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Symptoms - Fixed with proper text */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 block text-gray-900">Symptoms</h3>
                  
                  {selectedSymptomsCount < 3 && selectedSymptomsCount > 0 && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 text-sm">Insufficient Symptoms</p>
                        <p className="text-xs text-amber-700">
                          Please select at least {3 - selectedSymptomsCount} more symptom(s) for accurate prediction.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Fever */}
                    <div
                      className={`
                        flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer
                        ${formData.Fever ? 'bg-red-50 border-red-300 shadow-md' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
                      `}
                      onClick={() => handleInputChange('Fever', !formData.Fever)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${formData.Fever ? 'bg-red-100' : 'bg-gray-50'}`}>
                          <Thermometer className={`h-5 w-5 ${formData.Fever ? 'text-red-500' : 'text-gray-500'}`} />
                        </div>
                        <span className={`font-medium ${formData.Fever ? 'text-red-700' : 'text-gray-700'}`}>Fever</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.Fever}
                        onChange={(e) => handleInputChange('Fever', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </div>

                    {/* Headache */}
                    <div
                      className={`
                        flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer
                        ${formData.Headache ? 'bg-yellow-50 border-yellow-300 shadow-md' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
                      `}
                      onClick={() => handleInputChange('Headache', !formData.Headache)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${formData.Headache ? 'bg-yellow-100' : 'bg-gray-50'}`}>
                          <Brain className={`h-5 w-5 ${formData.Headache ? 'text-yellow-600' : 'text-gray-500'}`} />
                        </div>
                        <span className={`font-medium ${formData.Headache ? 'text-yellow-700' : 'text-gray-700'}`}>Headache</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.Headache}
                        onChange={(e) => handleInputChange('Headache', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </div>

                    {/* Abdominal Pain */}
                    <div
                      className={`
                        flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer
                        ${formData.Abdominal_Pain ? 'bg-orange-50 border-orange-300 shadow-md' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
                      `}
                      onClick={() => handleInputChange('Abdominal_Pain', !formData.Abdominal_Pain)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${formData.Abdominal_Pain ? 'bg-orange-100' : 'bg-gray-50'}`}>
                          <Activity className={`h-5 w-5 ${formData.Abdominal_Pain ? 'text-orange-500' : 'text-gray-500'}`} />
                        </div>
                        <span className={`font-medium ${formData.Abdominal_Pain ? 'text-orange-700' : 'text-gray-700'}`}>Abdominal Pain</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.Abdominal_Pain}
                        onChange={(e) => handleInputChange('Abdominal_Pain', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </div>

                    {/* General Body Malaise */}
                    <div
                      className={`
                        flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer
                        ${formData.General_Body_Malaise ? 'bg-blue-50 border-blue-300 shadow-md' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
                      `}
                      onClick={() => handleInputChange('General_Body_Malaise', !formData.General_Body_Malaise)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${formData.General_Body_Malaise ? 'bg-blue-100' : 'bg-gray-50'}`}>
                          <User className={`h-5 w-5 ${formData.General_Body_Malaise ? 'text-blue-500' : 'text-gray-500'}`} />
                        </div>
                        <span className={`font-medium ${formData.General_Body_Malaise ? 'text-blue-700' : 'text-gray-700'}`}>General Body Malaise</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.General_Body_Malaise}
                        onChange={(e) => handleInputChange('General_Body_Malaise', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </div>

                    {/* Dizziness */}
                    <div
                      className={`
                        flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer
                        ${formData.Dizziness ? 'bg-purple-50 border-purple-300 shadow-md' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
                      `}
                      onClick={() => handleInputChange('Dizziness', !formData.Dizziness)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${formData.Dizziness ? 'bg-purple-100' : 'bg-gray-50'}`}>
                          <Activity className={`h-5 w-5 ${formData.Dizziness ? 'text-purple-500' : 'text-gray-500'}`} />
                        </div>
                        <span className={`font-medium ${formData.Dizziness ? 'text-purple-700' : 'text-gray-700'}`}>Dizziness</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.Dizziness}
                        onChange={(e) => handleInputChange('Dizziness', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </div>

                    {/* Vomiting */}
                    <div
                      className={`
                        flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer
                        ${formData.Vomiting ? 'bg-green-50 border-green-300 shadow-md' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
                      `}
                      onClick={() => handleInputChange('Vomiting', !formData.Vomiting)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${formData.Vomiting ? 'bg-green-100' : 'bg-gray-50'}`}>
                          <Activity className={`h-5 w-5 ${formData.Vomiting ? 'text-green-600' : 'text-gray-500'}`} />
                        </div>
                        <span className={`font-medium ${formData.Vomiting ? 'text-green-700' : 'text-gray-700'}`}>Vomiting</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.Vomiting}
                        onChange={(e) => handleInputChange('Vomiting', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </div>

                    {/* Confusion */}
                    <div
                      className={`
                        flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer
                        ${formData.Confusion ? 'bg-red-50 border-red-300 shadow-md' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
                      `}
                      onClick={() => handleInputChange('Confusion', !formData.Confusion)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${formData.Confusion ? 'bg-red-100' : 'bg-gray-50'}`}>
                          <Brain className={`h-5 w-5 ${formData.Confusion ? 'text-red-400' : 'text-gray-500'}`} />
                        </div>
                        <span className={`font-medium ${formData.Confusion ? 'text-red-700' : 'text-gray-700'}`}>Confusion</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.Confusion}
                        onChange={(e) => handleInputChange('Confusion', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </div>

                    {/* Backache */}
                    <div
                      className={`
                        flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer
                        ${formData.Backache ? 'bg-amber-50 border-amber-300 shadow-md' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
                      `}
                      onClick={() => handleInputChange('Backache', !formData.Backache)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${formData.Backache ? 'bg-amber-100' : 'bg-gray-50'}`}>
                          <Bone className={`h-5 w-5 ${formData.Backache ? 'text-amber-700' : 'text-gray-500'}`} />
                        </div>
                        <span className={`font-medium ${formData.Backache ? 'text-amber-700' : 'text-gray-700'}`}>Backache</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.Backache}
                        onChange={(e) => handleInputChange('Backache', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </div>

                    {/* Chest Pain */}
                    <div
                      className={`
                        flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer
                        ${formData.Chest_Pain ? 'bg-pink-50 border-pink-300 shadow-md' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
                      `}
                      onClick={() => handleInputChange('Chest_Pain', !formData.Chest_Pain)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${formData.Chest_Pain ? 'bg-pink-100' : 'bg-gray-50'}`}>
                          <Heart className={`h-5 w-5 ${formData.Chest_Pain ? 'text-pink-500' : 'text-gray-500'}`} />
                        </div>
                        <span className={`font-medium ${formData.Chest_Pain ? 'text-pink-700' : 'text-gray-700'}`}>Chest Pain</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.Chest_Pain}
                        onChange={(e) => handleInputChange('Chest_Pain', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </div>

                    {/* Coughing */}
                    <div
                      className={`
                        flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer
                        ${formData.Coughing ? 'bg-cyan-50 border-cyan-300 shadow-md' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
                      `}
                      onClick={() => handleInputChange('Coughing', !formData.Coughing)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${formData.Coughing ? 'bg-cyan-100' : 'bg-gray-50'}`}>
                          <Wind className={`h-5 w-5 ${formData.Coughing ? 'text-cyan-500' : 'text-gray-500'}`} />
                        </div>
                        <span className={`font-medium ${formData.Coughing ? 'text-cyan-700' : 'text-gray-700'}`}>Coughing</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.Coughing}
                        onChange={(e) => handleInputChange('Coughing', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </div>

                    {/* Joint Pain */}
                    <div
                      className={`
                        flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer
                        ${formData.Joint_Pain ? 'bg-indigo-50 border-indigo-300 shadow-md' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
                      `}
                      onClick={() => handleInputChange('Joint_Pain', !formData.Joint_Pain)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${formData.Joint_Pain ? 'bg-indigo-100' : 'bg-gray-50'}`}>
                          <Bone className={`h-5 w-5 ${formData.Joint_Pain ? 'text-indigo-500' : 'text-gray-500'}`} />
                        </div>
                        <span className={`font-medium ${formData.Joint_Pain ? 'text-indigo-700' : 'text-gray-700'}`}>Joint Pain</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.Joint_Pain}
                        onChange={(e) => handleInputChange('Joint_Pain', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </div>
                  </div>
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
                    disabled={isLoading || !file || selectedSymptomsCount < 3} 
                    size="lg"
                    className="h-12 px-8 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Predict (Fusion)
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

                {/* Fusion Weights */}
                {result.explanation?.fusion_alpha !== undefined && (
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-purple-600" />
                      Fusion Weights
                    </h4>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>Clinical</span>
                          <span className="font-medium">{((result.explanation.clinical_weight || 0.5) * 100).toFixed(0)}%</span>
                        </div>
                        <ProgressBar value={(result.explanation.clinical_weight || 0.5) * 100} />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>Image</span>
                          <span className="font-medium">{((result.explanation.image_weight || 0.5) * 100).toFixed(0)}%</span>
                        </div>
                        <ProgressBar value={(result.explanation.image_weight || 0.5) * 100} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Component Scores */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Clinical Score</div>
                    <div className="text-base font-semibold">
                      {typeof result.clinical_score === "number" ? `${(result.clinical_score * 100).toFixed(1)}%` : "N/A"}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Image Score</div>
                    <div className="text-base font-semibold">
                      {typeof result.image_score === "number" ? `${(result.image_score * 100).toFixed(1)}%` : "N/A"}
                    </div>
                  </div>
                </div>

                {/* Clinical Scores */}
                {renderClinicalScores()}

                {/* Top Factors */}
                {renderTopFactors()}

                {/* Explanation Note */}
                {result.explanation?.note && (
                  <div className="mt-4 p-4 bg-white dark:bg-gray-900 rounded-lg border">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium mb-1 text-blue-800">Explanation</div>
                      <p className="text-sm text-blue-700">{result.explanation.note}</p>
                    </div>
                  </div>
                )}

                {/* Clinical Interpretation */}
                {renderHumanInterpretation()}

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

      {/* Heatmap Section */}
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
                  <img
                    src={heatmapSrc}
                    alt="Grad-CAM heatmap"
                    className="max-h-[400px] w-auto mx-auto rounded-md"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-700 flex items-center gap-2">
                <Info className="h-4 w-4 text-purple-600" />
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
      <Card className="mt-6 border-0 bg-gradient-to-br from-purple-50 to-pink-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white rounded-full shadow-sm">
              <Info className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">About Fusion Prediction</h3>
              <p className="text-gray-600 text-sm">
                Fusion prediction combines the clinical model (XGBoost) and the image model (ShuffleNetV2) using late-fusion weighting.
                The final output is a weighted probability with Grad-CAM for visual explainability. This multimodal approach 
                leverages both symptom data and blood smear images for improved diagnostic accuracy.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
