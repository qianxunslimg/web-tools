import {
  DownloadOutlined,
  PictureOutlined,
  RetweetOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
} from "@ant-design/icons";
import { Button, Card, Checkbox, InputNumber, Select, Slider, Space, message } from "antd";
import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from "react";

type OutputFormat = "image/jpeg" | "image/png" | "image/webp";
type FitMode = "contain" | "cover" | "stretch";

type ImageInfo = {
  fileName: string;
  fileSize: number;
  objectUrl: string;
  width: number;
  height: number;
  type: string;
};

type ExportResult = {
  blob: Blob;
  url: string;
  fileName: string;
  width: number;
  height: number;
  format: OutputFormat;
  quality: number;
};

const FORMAT_OPTIONS: Array<{ label: string; value: OutputFormat }> = [
  { label: "JPEG", value: "image/jpeg" },
  { label: "PNG", value: "image/png" },
  { label: "WebP", value: "image/webp" },
];

const FIT_MODE_OPTIONS: Array<{ label: string; value: FitMode }> = [
  { label: "完整缩放", value: "contain" },
  { label: "裁切填满", value: "cover" },
  { label: "拉伸到尺寸", value: "stretch" },
];

const SIZE_PRESETS = [
  { label: "原图尺寸", width: 0, height: 0 },
  { label: "一寸 295x413", width: 295, height: 413 },
  { label: "二寸 413x626", width: 413, height: 626 },
  { label: "报名照 480x640", width: 480, height: 640 },
  { label: "方形头像 800x800", width: 800, height: 800 },
  { label: "网页大图 1280x720", width: 1280, height: 720 },
];

const TARGET_SIZE_PRESETS = [50, 100, 200, 500];

function formatBytes(value: number) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  const kb = value / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(2)} MB`;
}

function getExtension(format: OutputFormat) {
  if (format === "image/png") {
    return "png";
  }
  if (format === "image/webp") {
    return "webp";
  }
  return "jpg";
}

function buildOutputName(fileName: string, format: OutputFormat) {
  const base = fileName.replace(/\.[^.]+$/, "") || "image";
  return `${base}-edited.${getExtension(format)}`;
}

function clampDimension(value: number | null | undefined) {
  const next = Math.round(Number(value) || 1);
  return Math.min(Math.max(next, 1), 8000);
}

function canvasToBlob(canvas: HTMLCanvasElement, format: OutputFormat, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("图片导出失败"));
          return;
        }
        resolve(blob);
      },
      format,
      format === "image/png" ? undefined : quality
    );
  });
}

export function ImageEditorTool() {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const autoGenerateSeq = useRef(0);
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [exportStale, setExportStale] = useState(false);
  const [exportNotice, setExportNotice] = useState("");
  const [outputWidth, setOutputWidth] = useState(800);
  const [outputHeight, setOutputHeight] = useState(800);
  const [lockRatio, setLockRatio] = useState(true);
  const [fitMode, setFitMode] = useState<FitMode>("contain");
  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  const [quality, setQuality] = useState(82);
  const [targetKb, setTargetKb] = useState<number | null>(200);
  const [rotation, setRotation] = useState(0);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");

  useEffect(() => {
    return () => {
      if (imageInfo?.objectUrl) {
        URL.revokeObjectURL(imageInfo.objectUrl);
      }
    };
  }, [imageInfo?.objectUrl]);

  useEffect(() => {
    return () => {
      if (exportResult?.url) {
        URL.revokeObjectURL(exportResult.url);
      }
    };
  }, [exportResult?.url]);

  function clearResult() {
    setExportResult((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
    setExportStale(false);
    setExportNotice("");
  }

  function markDirty() {
    if (imageInfo) {
      setExportStale(true);
      setExportNotice("");
    }
  }

  function updateWidth(value: number | null) {
    const nextWidth = clampDimension(value);
    setOutputWidth(nextWidth);
    if (lockRatio) {
      const ratio = outputWidth / outputHeight || 1;
      setOutputHeight(clampDimension(nextWidth / ratio));
    }
    markDirty();
  }

  function updateHeight(value: number | null) {
    const nextHeight = clampDimension(value);
    setOutputHeight(nextHeight);
    if (lockRatio) {
      const ratio = outputWidth / outputHeight || 1;
      setOutputWidth(clampDimension(nextHeight * ratio));
    }
    markDirty();
  }

  function applyPreset(width: number, height: number) {
    if (!imageInfo) {
      return;
    }
    if (width === 0 || height === 0) {
      setOutputWidth(imageInfo.width);
      setOutputHeight(imageInfo.height);
    } else {
      setOutputWidth(width);
      setOutputHeight(height);
    }
    markDirty();
  }

  function loadImageFile(file: File) {
    if (!file.type.startsWith("image/")) {
      message.warning("请选择图片文件");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setImageInfo({
        fileName: file.name,
        fileSize: file.size,
        objectUrl,
        width: image.naturalWidth,
        height: image.naturalHeight,
        type: file.type || "image/*",
      });
      setOutputWidth(image.naturalWidth);
      setOutputHeight(image.naturalHeight);
      setRotation(0);
      setFlipHorizontal(false);
      setFlipVertical(false);
      clearResult();
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      message.error("图片读取失败");
    };
    image.src = objectUrl;
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      loadImageFile(file);
      event.target.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      loadImageFile(file);
    }
  }

  function drawEditedImage(canvas: HTMLCanvasElement, targetWidth: number, targetHeight: number) {
    const sourceImage = imageRef.current;
    if (!sourceImage) {
      throw new Error("请先选择图片");
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("当前浏览器不支持 Canvas");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    const rotated = rotation % 180 !== 0;
    const stage = document.createElement("canvas");
    stage.width = rotated ? sourceImage.naturalHeight : sourceImage.naturalWidth;
    stage.height = rotated ? sourceImage.naturalWidth : sourceImage.naturalHeight;
    const stageCtx = stage.getContext("2d");
    if (!stageCtx) {
      throw new Error("当前浏览器不支持 Canvas");
    }

    stageCtx.imageSmoothingEnabled = true;
    stageCtx.imageSmoothingQuality = "high";
    stageCtx.translate(stage.width / 2, stage.height / 2);
    stageCtx.rotate((rotation * Math.PI) / 180);
    stageCtx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
    stageCtx.drawImage(sourceImage, -sourceImage.naturalWidth / 2, -sourceImage.naturalHeight / 2);

    if (fitMode === "stretch") {
      ctx.drawImage(stage, 0, 0, targetWidth, targetHeight);
      return;
    }

    const scale =
      fitMode === "cover"
        ? Math.max(targetWidth / stage.width, targetHeight / stage.height)
        : Math.min(targetWidth / stage.width, targetHeight / stage.height);

    if (fitMode === "cover") {
      const sourceWidth = targetWidth / scale;
      const sourceHeight = targetHeight / scale;
      ctx.drawImage(
        stage,
        (stage.width - sourceWidth) / 2,
        (stage.height - sourceHeight) / 2,
        sourceWidth,
        sourceHeight,
        0,
        0,
        targetWidth,
        targetHeight
      );
    } else {
      const drawWidth = stage.width * scale;
      const drawHeight = stage.height * scale;
      ctx.drawImage(
        stage,
        (targetWidth - drawWidth) / 2,
        (targetHeight - drawHeight) / 2,
        drawWidth,
        drawHeight
      );
    }
  }

  async function renderBlob(nextQuality: number) {
    const canvas = document.createElement("canvas");
    drawEditedImage(canvas, outputWidth, outputHeight);

    return canvasToBlob(canvas, format, nextQuality);
  }

  async function generateExport(sequence: number) {
    if (!imageInfo) {
      return;
    }

    try {
      const requestedQuality = Math.min(Math.max(quality / 100, 0.15), 0.95);
      const targetBytes = targetKb ? targetKb * 1024 : 0;
      let nextBlob: Blob;
      let usedQuality = requestedQuality;
      let nextNotice = "";

      if (targetBytes > 0 && format !== "image/png") {
        let low = 0.15;
        let high = requestedQuality;
        let bestBlob = await renderBlob(low);
        let bestQuality = low;

        if (bestBlob.size <= targetBytes) {
          for (let index = 0; index < 10; index += 1) {
            const mid = (low + high) / 2;
            const blob = await renderBlob(mid);
            if (blob.size <= targetBytes) {
              bestBlob = blob;
              bestQuality = mid;
              low = mid;
            } else {
              high = mid;
            }
          }
        } else {
          nextNotice = "当前尺寸下最低质量仍然超过目标大小，可以继续降低尺寸";
        }

        nextBlob = bestBlob;
        usedQuality = bestQuality;
      } else {
        nextBlob = await renderBlob(requestedQuality);
        if (targetBytes > 0 && format === "image/png" && nextBlob.size > targetBytes) {
          nextNotice = "PNG 不支持质量压缩；如需严格控制大小，建议导出 JPEG 或 WebP";
        }
      }

      if (sequence !== autoGenerateSeq.current) {
        return;
      }

      const nextUrl = URL.createObjectURL(nextBlob);
      setExportResult((current) => {
        if (current?.url) {
          URL.revokeObjectURL(current.url);
        }
        return {
          blob: nextBlob,
          url: nextUrl,
          fileName: buildOutputName(imageInfo.fileName, format),
          width: outputWidth,
          height: outputHeight,
          format,
          quality: usedQuality,
        };
      });
      setExportStale(false);
      setExportNotice(nextNotice);
    } catch (error) {
      if (sequence === autoGenerateSeq.current) {
        message.error(error instanceof Error ? error.message : "图片处理失败");
      }
    } finally {
      if (sequence === autoGenerateSeq.current) {
        setProcessing(false);
      }
    }
  }

  useEffect(() => {
    if (!imageInfo || !imageRef.current || !previewCanvasRef.current) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      if (!previewCanvasRef.current) {
        return;
      }
      const scale = Math.min(1200 / outputWidth, 900 / outputHeight, 1);
      drawEditedImage(
        previewCanvasRef.current,
        Math.max(1, Math.round(outputWidth * scale)),
        Math.max(1, Math.round(outputHeight * scale))
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    imageInfo,
    outputWidth,
    outputHeight,
    fitMode,
    format,
    rotation,
    flipHorizontal,
    flipVertical,
    backgroundColor,
  ]);

  useEffect(() => {
    if (!imageInfo || !imageRef.current) {
      return undefined;
    }

    const sequence = autoGenerateSeq.current + 1;
    autoGenerateSeq.current = sequence;
    setProcessing(true);
    setExportStale(true);
    setExportNotice("");

    const timer = window.setTimeout(() => {
      void generateExport(sequence);
    }, 280);

    return () => window.clearTimeout(timer);
  }, [
    imageInfo,
    outputWidth,
    outputHeight,
    fitMode,
    format,
    quality,
    targetKb,
    rotation,
    flipHorizontal,
    flipVertical,
    backgroundColor,
  ]);

  const sizeChange =
    imageInfo && exportResult
      ? `${Math.round((1 - exportResult.blob.size / imageInfo.fileSize) * 100)}%`
      : "";
  const actualQuality = exportResult ? Math.round(exportResult.quality * 100) : null;
  const canDownload = Boolean(exportResult && !processing && !exportStale);

  return (
    <section className="section-stack image-editor-shell">
      <div className="image-editor-layout">
        <Card className="panel-card image-editor-preview-card" bordered={false}>
          <div className="status-card-head image-editor-head">
            <div>
              <span className="section-chip">Local Editor</span>
              <h3>图片编辑器</h3>
            </div>
            <span className="image-editor-head-note">拖到预览区即可替换</span>
          </div>

          <label
            className={`image-editor-preview-stage${imageInfo ? " has-image" : " is-empty"}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              className="image-editor-preview-file-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
            {imageInfo ? (
              <>
                <canvas ref={previewCanvasRef} className="image-editor-preview-canvas" aria-label="图片预览" />
                <span className="image-editor-preview-action">
                  <PictureOutlined />
                  更换图片
                </span>
              </>
            ) : (
              <div className="image-editor-preview-empty">
                <PictureOutlined />
                <strong>点击或拖入图片</strong>
                <span>支持 JPEG、PNG、WebP</span>
              </div>
            )}
          </label>

          <div className="image-editor-metrics">
            <div>
              <span>原图</span>
              <strong>
                {imageInfo ? `${imageInfo.width} x ${imageInfo.height}` : "-"}
              </strong>
              <small>{imageInfo ? formatBytes(imageInfo.fileSize) : "-"}</small>
            </div>
            <div>
              <span>导出</span>
              <strong>
                {`${outputWidth} x ${outputHeight}`}
              </strong>
              <small>
                {processing
                  ? "自动生成中"
                  : exportResult
                    ? formatBytes(exportResult.blob.size)
                    : "选择图片后自动生成"}
              </small>
            </div>
            <div>
              <span>输出质量</span>
              <strong>{actualQuality ? `${actualQuality}%` : "-"}</strong>
              <small>
                {processing
                  ? "更新中"
                  : exportResult
                    ? `体积减少 ${sizeChange || "0%"}`
                    : "目标可选"}
              </small>
            </div>
          </div>
        </Card>

        <Card className="panel-card image-editor-control-card" bordered={false}>
          <div className="image-editor-control-section">
            <span className="section-chip">尺寸</span>
            <div className="image-editor-setting-grid">
              <label>
                <span>宽度 px</span>
                <InputNumber min={1} max={8000} value={outputWidth} onChange={updateWidth} />
              </label>
              <label>
                <span>高度 px</span>
                <InputNumber min={1} max={8000} value={outputHeight} onChange={updateHeight} />
              </label>
            </div>
            <Checkbox checked={lockRatio} onChange={(event) => setLockRatio(event.target.checked)}>
              锁定当前比例
            </Checkbox>
            <div className="image-editor-presets">
              {SIZE_PRESETS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="image-editor-pill"
                  disabled={!imageInfo}
                  onClick={() => applyPreset(item.width, item.height)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="image-editor-control-section">
            <span className="section-chip">编辑</span>
            <Select<FitMode>
              value={fitMode}
              options={FIT_MODE_OPTIONS}
              onChange={(value) => {
                setFitMode(value);
                markDirty();
              }}
            />
            <Space wrap>
              <Button
                icon={<RotateLeftOutlined />}
                onClick={() => {
                  setRotation((current) => (current + 270) % 360);
                  markDirty();
                }}
              >
                左转
              </Button>
              <Button
                icon={<RotateRightOutlined />}
                onClick={() => {
                  setRotation((current) => (current + 90) % 360);
                  markDirty();
                }}
              >
                右转
              </Button>
              <Button
                icon={<RetweetOutlined />}
                onClick={() => {
                  setFlipHorizontal((current) => !current);
                  markDirty();
                }}
              >
                横翻
              </Button>
              <Button
                icon={<RetweetOutlined />}
                onClick={() => {
                  setFlipVertical((current) => !current);
                  markDirty();
                }}
              >
                竖翻
              </Button>
            </Space>
          </div>

          <div className="image-editor-control-section">
            <span className="section-chip">导出</span>
            <div className="image-editor-setting-grid image-editor-export-grid">
              <label>
                <span>格式</span>
                <Select<OutputFormat>
                  value={format}
                  options={FORMAT_OPTIONS}
                  onChange={(value) => {
                    setFormat(value);
                    markDirty();
                  }}
                />
              </label>
              <label>
                <span>背景色</span>
                <input
                  className="image-editor-color-input"
                  type="color"
                  value={backgroundColor}
                  onChange={(event) => {
                    setBackgroundColor(event.target.value);
                    markDirty();
                  }}
                />
              </label>
              <label>
                <span>目标大小 KB</span>
                <InputNumber min={1} max={20000} value={targetKb} onChange={setTargetKb} />
              </label>
            </div>
            <div className="image-editor-slider-row">
              <span>{targetKb && format !== "image/png" ? "质量上限" : "质量"} {quality}%</span>
              <Slider
                min={15}
                max={95}
                value={quality}
                disabled={format === "image/png"}
                onChange={(value) => {
                  setQuality(value);
                  markDirty();
                }}
              />
              <small>
                {format === "image/png"
                  ? "PNG 不支持质量压缩"
                  : targetKb
                    ? `目标大小优先，实际输出质量${actualQuality ? ` ${actualQuality}%` : "会自动计算"}`
                    : "不限制目标大小时，导出质量按滑块执行"}
              </small>
            </div>
            <div className="image-editor-presets">
              {TARGET_SIZE_PRESETS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="image-editor-pill"
                  onClick={() => {
                    setTargetKb(item);
                    markDirty();
                  }}
                >
                  {item} KB
                </button>
              ))}
              <button
                type="button"
                className="image-editor-pill"
                onClick={() => {
                  setTargetKb(null);
                  markDirty();
                }}
              >
                不限制
              </button>
            </div>
          </div>

          <div className="image-editor-actions">
            <Button
              type="primary"
              size="large"
              icon={<DownloadOutlined />}
              href={exportResult?.url}
              download={exportResult?.fileName}
              disabled={!canDownload}
            >
              {processing ? "自动生成中" : "下载图片"}
            </Button>
            <span className="image-editor-live-status">
              {exportNotice || (imageInfo ? "修改会自动更新预览和下载文件" : "选择图片后自动生成")}
            </span>
          </div>
        </Card>
      </div>
    </section>
  );
}
