import * as React from "react";
import "../../css/tailwind.css";
import { useState, useEffect } from "react";

export function App() {
  const [files, setFiles] = useState([]);
  const [fileTypes, setFileTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load dashboard data
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const response = await frappe.call({
        method: "cloud_file_manager.api.cloud_file_api.get_dashboard_data",
      });
      if (response && response.message) {
        setFiles(response.message.recent_files || []);
        setFileTypes(response.message.file_types || []);
        setIsLoading(false);
      } else {
        console.error("Invalid response from server:", response);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNewFile = () => {
    frappe.new_doc("Cloud File");
  };

  const handleViewAllFiles = () => {
    frappe.set_route("List", "Cloud File");
  };

  // Render file types chart after component mounts
  useEffect(() => {
    if (fileTypes.length > 0 && !isLoading) {
      const data = {
        labels: fileTypes.map((d) => d.file_type || __("not specified")), // Not Specified
        datasets: [{ values: fileTypes.map((d) => d.count) }],
      };

      // Check if the chart container exists
      if (document.getElementById("files-by-type-chart")) {
        new frappe.Chart("#files-by-type-chart", {
          data: data,
          type: "pie",
          height: 220,
          colors: ["#7cd6fd", "#743ee2", "#5eaa5f", "#ff5858"],
        });
      }
    }
  }, [fileTypes, isLoading]);

  if (isLoading) {
    return (
      <main className="tw">
        <div className="tw-flex tw-justify-center tw-items-center tw-h-52">
          <div className="tw-text-slate-400">
            {/* กำลังโหลดข้อมูลแดชบอร์ด... */}
            <span>{__("Loading Dashboard Data...")}</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="tw">
      <div className="cloud-file-dashboard tw-p-6">
        <div className="dashboard-header tw-mb-6">
          {/* แดชบอร์ดไฟล์คลาวด์ */}
          <h3>{__("Cloud File Dashboard")}</h3>
          {/* ภาพรวมของไฟล์คลาวด์ของคุณ */}
          <p className="tw-text-slate-600">{__("Overall")}</p>
        </div>

        <div className="tw-grid tw-grid-cols-1 tw-md:grid-cols-2 tw-gap-6 tw-mb-6">
          <div className="stats-box tw-bg-white tw-p-4 tw-rounded tw-shadow">
            {/* ไฟล์ตามประเภท */}
            <h4 className="tw-mb-4">{__("Files Cat.")}</h4>
            <div id="files-by-type-chart" className="w-h-56"></div>
          </div>

          <div className="stats-box tw-bg-white tw-p-4 tw-rounded tw-shadow">
            {/* ไฟล์ล่าสุด */}
            <h4 className="tw-mb-4">{__("Lasted file")}</h4>
            {files.length > 0 ? (
              <div className="tw-overflow-x-auto">
                <table className="tw-w-full">
                  <thead>
                    <tr className="tw-border-b">
                      <th className="tw-text-left tw-py-2">
                        {__("Files URL")}
                      </th>
                      {/* URL ของไฟล์ */}
                      <th className="tw-text-left tw-py-2">
                        {__("Categories")}
                      </th>
                      {/* ประเภท */}
                      <th className="tw-text-left tw-py-2">
                        {/* การอ้างอิง */}
                        {__("Reference")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file, idx) => (
                      <tr key={idx} className="tw-border-b">
                        <td className="tw-py-2">
                          <a
                            href={file.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {file.file_url.substring(0, 30)}...
                          </a>
                        </td>
                        <td className="tw-py-2">
                          {file.file_type || __("not specified")}
                          {/* ไม่ได้ระบุ */}
                        </td>
                        <td className="tw-py-2">
                          {file.ref_doctype
                            ? `${file.ref_doctype}: ${file.ref_docname}`
                            : __("no files")}
                          {/* ไม่มี */}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="tw-flex tw-justify-center tw-items-center tw-h-40 tw-text-slate-500">
                {/* ยังไม่มีไฟล์ที่อัปโหลด */}
                {__("no files uploaded yet")}
              </div>
            )}
          </div>
        </div>

        <div className="action-buttons">
          <button className="btn btn-primary mr-2" onClick={handleAddNewFile}>
            {/* เพิ่มไฟล์ใหม่ */}
            {__("Add File")}
          </button>
          <button className="btn btn-default" onClick={handleViewAllFiles}>
            {/* ดูไฟล์ทั้งหมด */}
            {__("List Files")}
          </button>
        </div>
      </div>
    </main>
  );
}
