import { Alert, Button, Card, Input, Space, Table, message } from "antd";
import { useEffect, useState } from "react";

import { analyzeByp, fetchSiteRuntime } from "../../api/client";
import type {
  BypAnalysisData,
  ClassAnalysisItem,
  SiteRuntimeData,
  StudentAnalysisItem,
} from "../../api/types";
import type { ToolkitTabKey } from "../../app/types";
import { GptTokenConverterTool } from "./GptTokenConverterTool";
import { ImageEditorTool } from "./ImageEditorTool";
import {
  AlmanacTool,
  CodecTool,
  ColorTool,
  HoroscopeBirthdayTool,
  LifeProgressTool,
  PdfTool,
  QrTool,
  RegexTool,
  TextTool,
  TimeTool,
  UnitConverterTool,
} from "./UtilityTools";

const defaultExcelUrl = "";

type ToolkitSectionProps = {
  activeTab: ToolkitTabKey;
};

export function ToolkitSection({ activeTab }: ToolkitSectionProps) {
  const [runtime, setRuntime] = useState<SiteRuntimeData | null>(null);

  const [excelUrl, setExcelUrl] = useState(defaultExcelUrl);
  const [analysis, setAnalysis] = useState<BypAnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRuntime() {
      try {
        const response = await fetchSiteRuntime();
        if (!active) {
          return;
        }
        setRuntime(response.data ?? null);
      } catch {
        if (!active) {
          return;
        }
        setRuntime(null);
      }
    }

    void loadRuntime();
    return () => {
      active = false;
    };
  }, []);

  async function handleAnalyze() {
    if (runtime && runtime.feature_map.toolkit_byp_analyze === false) {
      message.warning("BYP 工具当前已关闭");
      return;
    }
    if (!excelUrl.trim()) {
      message.warning("请先输入 Excel URL");
      return;
    }
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const response = await analyzeByp(excelUrl.trim());
      setAnalysis(response.data ?? null);
      message.success("分析完成");
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "分析失败";
      setAnalysisError(messageText);
      setAnalysis(null);
    } finally {
      setAnalysisLoading(false);
    }
  }

  function renderAnalyzeCard() {
    return (
      <Card className="panel-card analyzer-card" bordered={false}>
        <div className="status-card-head">
          <div>
            <h3>BYP</h3>
          </div>
        </div>
        <Space.Compact block>
          <Input
            size="large"
            placeholder="Excel 链接"
            value={excelUrl}
            onChange={(event) => setExcelUrl(event.target.value)}
          />
          <Button type="primary" size="large" loading={analysisLoading} onClick={() => void handleAnalyze()}>
            开始分析
          </Button>
        </Space.Compact>
        {runtime?.feature_map.toolkit_byp_analyze === false ? (
          <Alert className="tool-alert" type="info" message="当前运维配置已关闭 BYP 工具。" showIcon />
        ) : null}
        {analysisError ? <Alert className="tool-alert" type="error" message={analysisError} showIcon /> : null}
        {!analysis && !analysisLoading ? (
          <div className="tool-empty">
            <p>输入链接后开始分析。</p>
          </div>
        ) : null}
      </Card>
    );
  }

  if (activeTab === "image-editor") {
    return <ImageEditorTool />;
  }

  if (activeTab === "time") {
    return <TimeTool />;
  }

  if (activeTab === "horoscope") {
    return <HoroscopeBirthdayTool />;
  }

  if (activeTab === "almanac") {
    return <AlmanacTool />;
  }

  if (activeTab === "regex") {
    return <RegexTool />;
  }

  if (activeTab === "unit") {
    return <UnitConverterTool />;
  }

  if (activeTab === "life") {
    return <LifeProgressTool />;
  }

  if (activeTab === "qr") {
    return <QrTool />;
  }

  if (activeTab === "pdf") {
    return <PdfTool />;
  }

  if (activeTab === "codec") {
    return <CodecTool />;
  }

  if (activeTab === "color") {
    return <ColorTool />;
  }

  if (activeTab === "text") {
    return <TextTool />;
  }

  if (activeTab === "gpt-token") {
    return <GptTokenConverterTool />;
  }

  return (
    <section className="section-stack">
      <div className="toolkit-grid">{renderAnalyzeCard()}</div>

      {analysis ? (
        <div className="analysis-grid">
          <Card className="panel-card" bordered={false}>
            <div className="result-head">
              <h3>班级统计</h3>
              <span>{analysis.response_at}</span>
            </div>
            <Table<ClassAnalysisItem>
              rowKey="class_name"
              pagination={false}
              dataSource={analysis.class_stat}
              columns={[
                { title: "班级", dataIndex: "class_name" },
                { title: "作业减分", dataIndex: "homework_deduction" },
                { title: "日常减分", dataIndex: "daily_deduction" },
                { title: "迟到减分", dataIndex: "late_deduction" },
              ]}
            />
          </Card>

          <Card className="panel-card" bordered={false}>
            <div className="result-head">
              <h3>学生排行</h3>
              <span>Top {analysis.student_stat.length}</span>
            </div>
            <Table<StudentAnalysisItem>
              rowKey={(record) => record.student_name + "-" + record.rank}
              pagination={false}
              dataSource={analysis.student_stat}
              columns={[
                { title: "排名", dataIndex: "rank", width: 88 },
                { title: "姓名", dataIndex: "student_name" },
                { title: "总加分", dataIndex: "total_add_score", width: 110 },
                { title: "加分明细", dataIndex: "bonus_details" },
              ]}
            />
          </Card>
        </div>
      ) : null}
    </section>
  );
}
