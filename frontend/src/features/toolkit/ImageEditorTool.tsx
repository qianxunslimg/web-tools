import {
  DownloadOutlined,
  PictureOutlined,
  RetweetOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
} from "@ant-design/icons";
import { Button, Card, Checkbox, InputNumber, Select, Slider, Space, message } from "antd";
import { type ChangeEvent, type DragEvent, type MouseEvent, useEffect, useRef, useState } from "react";

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

type DetailPreview = {
  visible: boolean;
  x: number;
  y: number;
  bgX: number;
  bgY: number;
};

const DETAIL_PREVIEW_WIDTH = 150;
const DETAIL_PREVIEW_HEIGHT = 104;

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
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const autoGenerateSeq = useRef(0);
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [detailPreview, setDetailPreview] = useState<DetailPreview>({
    visible: false,
    x: 0,
    y: 0,
    bgX: 0,
    bgY: 0,
  });
  const [processing, setProcessing] = useState(false);
  const [exportStale, setExportStale] = useState(false);
  const [exportNotice, setExportNotice] = useState("");
  const [outputWidth, setOutputWidth] = useState(800);
  const [outputHeight, setOutputHeight] = useState(800);
  const [lockRatio, setLockRatio] = useState(true);
  const [fitMode, setFitMode] = useState<FitMode>("contain");
  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  const [quality, setQuality] = useState(82);
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
      hideDetailPreview();
    }
  }

  function hideDetailPreview() {
    setDetailPreview((current) => (current.visible ? { ...current, visible: false } : current));
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

  function handlePreviewMouseMove(event: MouseEvent<HTMLLabelElement>) {
    if (!exportResult || exportStale || processing || !previewImageRef.current) {
      hideDetailPreview();
      return;
    }

    const imageRect = previewImageRef.current.getBoundingClientRect();
    const stageRect = event.currentTarget.getBoundingClientRect();
    const imageX = event.clientX - imageRect.left;
    const imageY = event.clientY - imageRect.top;

    if (imageX < 0 || imageY < 0 || imageX > imageRect.width || imageY > imageRect.height) {
      hideDetailPreview();
      return;
    }

    const pointerX = event.clientX - stageRect.left;
    const pointerY = event.clientY - stageRect.top;
    const offset = 16;
    const maxX = stageRect.width - DETAIL_PREVIEW_WIDTH - 8;
    const maxY = stageRect.height - DETAIL_PREVIEW_HEIGHT - 8;
    const preferredX =
      pointerX + offset + DETAIL_PREVIEW_WIDTH > stageRect.width
        ? pointerX - DETAIL_PREVIEW_WIDTH - offset
        : pointerX + offset;
    const preferredY =
      pointerY + offset + DETAIL_PREVIEW_HEIGHT > stageRect.height
        ? pointerY - DETAIL_PREVIEW_HEIGHT - offset
        : pointerY + offset;
    const nextX = Math.min(Math.max(preferredX, 8), Math.max(maxX, 8));
    const nextY = Math.min(Math.max(preferredY, 8), Math.max(maxY, 8));
    const bgX = Math.min(
      Math.max((imageX / imageRect.width) * exportResult.width - DETAIL_PREVIEW_WIDTH / 2, 0),
      Math.max(exportResult.width - DETAIL_PREVIEW_WIDTH, 0)
    );
    const bgY = Math.min(
      Math.max((imageY / imageRect.height) * exportResult.height - DETAIL_PREVIEW_HEIGHT / 2, 0),
      Math.max(exportResult.height - DETAIL_PREVIEW_HEIGHT, 0)
    );

    setDetailPreview({
      visible: true,
      x: nextX,
      y: nextY,
      bgX,
      bgY,
    });
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
      const nextBlob = await renderBlob(requestedQuality);
      const usedQuality = format === "image/png" ? 1 : requestedQuality;

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
      setExportNotice("");
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
    rotation,
    flipHorizontal,
    flipVertical,
    backgroundColor,
  ]);

  const sizeChangePercent =
    imageInfo && exportResult
      ? Math.round((1 - exportResult.blob.size / imageInfo.fileSize) * 100)
      : null;
  const sizeChangeLabel =
    sizeChangePercent === null
      ? ""
      : sizeChangePercent >= 0
        ? `体积减少 ${sizeChangePercent}%`
        : `体积增加 ${Math.abs(sizeChangePercent)}%`;
  const sizeCompareLabel =
    sizeChangePercent === null
      ? ""
      : sizeChangePercent >= 0
        ? `比原图小 ${sizeChangePercent}%`
        : `比原图大 ${Math.abs(sizeChangePercent)}%`;
  const actualQuality = exportResult ? Math.round(exportResult.quality * 100) : null;
  const currentOutputSize = exportResult ? formatBytes(exportResult.blob.size) : "-";
  const currentOutputSizeLabel = imageInfo ? (processing ? "计算中" : currentOutputSize) : "选择图片后显示";
  const canDownload = Boolean(exportResult && !processing && !exportStale);
  const previewImageUrl = exportResult?.url || imageInfo?.objectUrl;
  const liveStatus =
    exportNotice ||
    (!imageInfo
      ? "选择图片后自动生成"
      : sizeChangePercent !== null && sizeChangePercent < 0
        ? "当前导出比原图更大，降低编码质量或尺寸可以减小体积"
        : "修改会自动更新预览和下载文件");

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
            onMouseMove={handlePreviewMouseMove}
            onMouseLeave={hideDetailPreview}
          >
            <input
              className="image-editor-preview-file-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
            {imageInfo ? (
              <>
                <img
                  ref={previewImageRef}
                  className={`image-editor-preview-output${exportStale ? " is-stale" : ""}`}
                  src={previewImageUrl}
                  alt="导出预览"
                />
                {exportResult ? (
                  <span
                    className={`image-editor-detail-preview${detailPreview.visible ? " is-visible" : ""}`}
                    style={{
                      backgroundImage: `url(${exportResult.url})`,
                      backgroundPosition: `-${detailPreview.bgX}px -${detailPreview.bgY}px`,
                      backgroundSize: `${exportResult.width}px ${exportResult.height}px`,
                      transform: `translate(${detailPreview.x}px, ${detailPreview.y}px)`,
                    }}
                    aria-label="1:1 细节预览"
                  >
                    <span>1:1 细节</span>
                  </span>
                ) : null}
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
              <span>导出尺寸</span>
              <strong>
                {`${outputWidth} x ${outputHeight}`}
              </strong>
              <small>
                {processing
                  ? "更新中"
                  : exportResult
                    ? "已自动生成"
                    : "选择图片后自动生成"}
              </small>
            </div>
            <div>
              <span>当前大小</span>
              <strong>{processing ? "计算中" : currentOutputSize}</strong>
              <small>
                {processing
                  ? "更新中"
                  : exportResult
                    ? `${format === "image/png" ? "PNG" : `质量 ${actualQuality}%`} · ${sizeChangeLabel}`
                    : "随质量自动更新"}
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
            </div>
            <div className="image-editor-slider-row">
              <span>{format === "image/png" ? "编码质量（PNG 不使用）" : `编码质量 ${quality}%`}</span>
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
                  ? `PNG 体积主要由尺寸决定，当前大小 ${currentOutputSizeLabel}`
                  : `重新编码后大小 ${currentOutputSizeLabel}${sizeCompareLabel ? `，${sizeCompareLabel}` : ""}`}
              </small>
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
              {liveStatus}
            </span>
          </div>
        </Card>
      </div>
    </section>
  );
}
