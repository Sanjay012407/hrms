// src/pages/CertificatesPage.js
import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCertificates } from "../context/CertificateContext";
import { getImageUrl } from '../utils/config';

export default function CertificatesPage() {
  const { Certificates, deleteCertificate } = useCertificates();
  const [search, setSearch] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedCertificate, setSelectedCertificate] = useState(null); // 
  const navigate = useNavigate();

  // Get unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    const Profiles = [...new Set(Certificates.map(c => c.profileName).filter(Boolean))].sort();
    const certificateNames = [...new Set(certificates.map(c => c.Certificate).filter(Boolean))].sort();
    const companies = [...new Set(certificates.map(c => c.company).filter(Boolean))].sort();
    const teams = [...new Set(certificates.map(c => c.team).filter(Boolean))].sort();
    const providers = [...new Set(certificates.map(c => c.provider).filter(Boolean))].sort();
    const activeStatuses = [...new Set(certificates.map(c => c.Active).filter(Boolean))].sort();
    
    return { profiles, certificateNames, companies, teams, providers, activeStatuses };
  }, [certificates]);

  const handleDeleteCertificate = async (certificateId, certificateName) => {
    if (window.confirm(`Are you sure you want to delete the certificate "${certificateName}"? This action cannot be undone.`)) {
      try {
        await deleteCertificate(certificateId);
        setSelectedCertificate(null); // close sidebar if open
      } catch (error) {
        console.error('Failed to delete Certificate:', error);
        alert('Failed to delete Certificate. Please try again.');
      }
    }
  };

  // Memoized filtered Certificates
  const filteredCertificates = useMemo(() => {
    if (!search) return certificates;
    return certificates.filter((c) => 
      c.certificate.toLowerCase().includes(search.toLowerCase())
    );
  }, [certificates, search]);

  // Virtual scrolling implementation
  const visibleCertificates = useMemo(() => {
    return filteredCertificates.slice(0, rowsPerPage);
  }, [filteredCertificates, rowsPerPage]);

  return (
    <div className="relative p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-4xl font-bold">Certificates</h1>
        <button 
          onClick={() => navigate("/Dashboard/createcretificate")}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow">
          + Create Certificate
        </button>
      </div>

      {/* Certificates table */}
      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">VTID</th>
              <th className="border px-2 py-1">Certificate</th>
              <th className="border px-2 py-1">Category</th>
              <th className="border px-2 py-1">Job Role</th>
              <th className="border px-2 py-1">Expiry Date</th>
              <th className="border px-2 py-1">Profile</th>
              <th className="border px-2 py-1">Status</th>
              <th className="border px-2 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCertificates.slice(0, rowsPerPage).map((c) => (
              <tr 
                key={c.id || c._id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedCertificate(c)}
              >
                <td className="border px-2 py-1">{c.profileId?.vtid || 'N/A'}</td>
                <td className="border px-2 py-1">{c.Certificate}</td>
                <td className="border px-2 py-1">{c.category}</td>
                <td className="border px-2 py-1">{c.jobRole || "N/A"}</td>
                <td className="border px-2 py-1">{c.expiryDate}</td>
                <td className="border px-2 py-1">{c.profileName}</td>
                <td className="border px-2 py-1">{c.status}</td>
                <td className="border px-2 py-1 text-center">
                  <Link to={`/viewcertificate/${c.id || c._id}`} className="text-blue-600 mr-2">👁</Link>
                  <Link to={`/editcertificate/${c.id || c._id}`} className="text-gray-600 mr-2">⚙</Link>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation(); // prevent sidebar opening
                      handleDeleteCertificate(c.id || c._id, c.Certificate);
                    }}
                    className="text-red-600 hover:text-red-800" 
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sidebar Drawer */}
      {selectedCertificate && (
        <div className="fixed inset-0 z-50 flex">
          {/* Dark backdrop */}
          <div 
            className="flex-1 bg-black/50"
            onClick={() => setSelectedCertificate(null)}
          ></div>

          {/* Sidebar content */}
          <div className="w-96 bg-white shadow-xl p-6 overflow-y-auto transition-transform transform translate-x-0">
            <h2 className="text-2xl font-bold mb-4">{selectedCertificate.Certificate}</h2>
            <p className="text-sm text-gray-600 mb-2"><strong>Profile:</strong> {selectedCertificate.profileName}</p>
            <p className="text-sm text-gray-600 mb-2"><strong>Category:</strong> {selectedCertificate.category}</p>
            <p className="text-sm text-gray-600 mb-2"><strong>Job Role:</strong> {selectedCertificate.jobRole}</p>
            <p className="text-sm text-gray-600 mb-2"><strong>Company:</strong> {selectedCertificate.company}</p>
            <p className="text-sm text-gray-600 mb-2"><strong>Team:</strong> {selectedCertificate.team}</p>
            <p className="text-sm text-gray-600 mb-2"><strong>Provider:</strong> {selectedCertificate.provider}</p>
            <p className="text-sm text-gray-600 mb-2"><strong>Issue Date:</strong> {selectedCertificate.issueDate}</p>
            <p className="text-sm text-gray-600 mb-2"><strong>Expiry Date:</strong> {selectedCertificate.expiryDate}</p>
            <p className="text-sm text-gray-600 mb-2"><strong>Status:</strong> {selectedCertificate.status}</p>
            <p className="text-sm text-gray-600 mb-2"><strong>Cost:</strong> £{selectedCertificate.cost}</p>

            {selectedCertificate.certificateFile && (
              <a 
                href={getImageUrl(selectedCertificate.certificateFile)} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 underline block mt-4"
              >
                View File
              </a>
            )}

            <div className="mt-6 flex gap-3">
              <Link 
                to={`/editcertificate/${selectedCertificate.id || selectedCertificate._id}`} 
                className="px-4 py-2 bg-gray-600 text-white rounded"
              >
                Edit
              </Link>
              <button 
                onClick={() => handleDeleteCertificate(selectedCertificate.id || selectedCertificate._id, selectedCertificate.Certificate)}
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
