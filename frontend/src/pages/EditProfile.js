import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { useProfiles } from "../context/ProfileContext";
import { getAllJobRoles } from "../data/certificateJobRoleMapping";
import SearchableDropdown from "../components/SearchableDropdown";
import JobLevelDropdown from "../components/JobLevelDropdown";
import SyncfusionDatePicker from "../components/SyncfusionDatePicker";


export default function EditProfile() {
  const navigate = useNavigate();
  const { userProfile, updateUserProfile } = useProfiles();
  
  // State for job roles and job levels
  const [jobRoles, setJobRoles] = useState([]);
  const [jobLevels, setJobLevels] = useState([]);

  // Load job roles and job levels on component mount
  useEffect(() => {
    fetchJobRoles();
    fetchJobLevels();
  }, []);

  const getApiUrl = () => {
    // In development, use localhost URL
    if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL;
    }
    // In production or when API_BASE_URL is relative, use relative path
    if (process.env.REACT_APP_API_BASE_URL?.startsWith('/')) {
      return '';
    }
    // Fallback to localhost for development
    return process.env.REACT_APP_API_URL || 'http://localhost:5003';
  };

  const fetchJobRoles = async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/job-roles`);
      if (response.ok) {
        const data = await response.json();
        setJobRoles(data);
        console.log('Job roles loaded:', data);
      } else {
        console.error('Failed to fetch job roles:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching job roles:', error);
    }
  };

  const fetchJobLevels = async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/job-levels`);
      if (response.ok) {
        const data = await response.json();
        setJobLevels(data);
        console.log('Job levels loaded:', data);
      } else {
        console.error('Failed to fetch job levels:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching job levels:', error);
    }
  };

  const handleJobRoleSearch = async (searchTerm) => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/job-roles/search?q=${encodeURIComponent(searchTerm)}`);
      if (response.ok) {
        const data = await response.json();
        setJobRoles(data);
      } else {
        console.error('Failed to search job roles:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error searching job roles:', error);
    }
  };

  const handleAddJobRole = async (jobRoleName) => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/job-roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: jobRoleName }),
      });
      
      if (response.ok) {
        const newJobRole = await response.json();
        console.log('New job role added:', newJobRole);
        // Update job roles list
        fetchJobRoles();
        // Add to selected job titles
        setFormData(prev => ({
          ...prev,
          jobTitle: [...(prev.jobTitle || []), jobRoleName]
        }));
      } else {
        console.error('Failed to add job role:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error adding job role:', error);
    }
  };

  const handleJobLevelSearch = async (searchTerm) => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/job-levels/search?q=${encodeURIComponent(searchTerm)}`);
      if (response.ok) {
        const data = await response.json();
        setJobLevels(data);
      } else {
        console.error('Failed to search job levels:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error searching job levels:', error);
    }
  };

  const handleAddJobLevel = async (jobLevelName) => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/job-levels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: jobLevelName }),
      });
      
      if (response.ok) {
        const newJobLevel = await response.json();
        console.log('New job level added:', newJobLevel);
        // Update job levels list
        fetchJobLevels();
        // Update form
        setFormData(prev => ({ ...prev, jobLevel: jobLevelName }));
      } else {
        console.error('Failed to add job level:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error adding job level:', error);
    }
  };

  const [formData, setFormData] = useState({
    username: userProfile.email,
    firstName: userProfile.firstName,
    lastName: userProfile.lastName,
    email: userProfile.email,
    dob: userProfile.dateOfBirth,
    gender: userProfile.gender,
    company: userProfile.company,
    jobTitle: Array.isArray(userProfile.jobTitle) ? userProfile.jobTitle : (userProfile.jobTitle ? [userProfile.jobTitle] : []),
    staffType: userProfile.staffType,
    mobile: userProfile.mobile,
    nationality: userProfile.nationality,
    poc: userProfile.poc,
    circetUIN: userProfile.circetUIN,
    circetSCID: userProfile.circetSCID,
    morrisonsIDNumber: userProfile.morrisonsIDNumber,
    morrisonsUIN: userProfile.morrisonsUIN,
    nopsID: userProfile.nopsID,
    status: userProfile.status,
    otherInfo: userProfile.otherInformation,
    bio: userProfile.bio,
    language: userProfile.language,
    // Address fields
    addressLine1: userProfile.address?.line1 || '',
    addressLine2: userProfile.address?.line2 || '',
    city: userProfile.address?.city || '',
    postCode: userProfile.address?.postCode || '',
    country: userProfile.address?.country || '',
    // Emergency contact
    emergencyName: userProfile.emergencyContact?.name || '',
    emergencyRelationship: userProfile.emergencyContact?.relationship || '',
    emergencyPhone: userProfile.emergencyContact?.phone || '',
  });

  // Update form data when userProfile changes (especially email)
  useEffect(() => {
    setFormData({
      username: userProfile.email,
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      email: userProfile.email,
      dob: userProfile.dateOfBirth,
      gender: userProfile.gender,
      company: userProfile.company,
      jobTitle: Array.isArray(userProfile.jobTitle) ? userProfile.jobTitle : (userProfile.jobTitle ? [userProfile.jobTitle] : []),
      staffType: userProfile.staffType,
      mobile: userProfile.mobile,
      nationality: userProfile.nationality,
      poc: userProfile.poc,
      circetUIN: userProfile.circetUIN,
      circetSCID: userProfile.circetSCID,
      morrisonsIDNumber: userProfile.morrisonsIDNumber,
      morrisonsUIN: userProfile.morrisonsUIN,
      nopsID: userProfile.nopsID,
      status: userProfile.status,
      otherInfo: userProfile.otherInformation,
      bio: userProfile.bio,
      language: userProfile.language,
      // Address fields
      addressLine1: userProfile.address?.line1 || '',
      addressLine2: userProfile.address?.line2 || '',
      city: userProfile.address?.city || '',
      postCode: userProfile.address?.postCode || '',
      country: userProfile.address?.country || '',
      // Emergency contact
      emergencyName: userProfile.emergencyContact?.name || '',
      emergencyRelationship: userProfile.emergencyContact?.relationship || '',
      emergencyPhone: userProfile.emergencyContact?.phone || '',
    });
  }, [userProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleJobTitleChange = (jobRole) => {
    setFormData((prev) => {
      const currentJobTitles = prev.jobTitle || [];
      const isSelected = currentJobTitles.includes(jobRole);
      
      if (isSelected) {
        // Remove job role
        return {
          ...prev,
          jobTitle: currentJobTitles.filter(title => title !== jobRole)
        };
      } else {
        // Add job role
        return {
          ...prev,
          jobTitle: [...currentJobTitles, jobRole]
        };
      }
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    try {
      // Transform form data to match API expectations
      const profileData = {
        ...formData,
        // Handle job roles/titles properly
        jobRole: formData.jobTitle,
        // Convert date strings to proper format
        dateOfBirth: formData.dob ? new Date(formData.dob).toISOString() : null,
        // Ensure nested objects are properly structured
        address: {
          line1: formData.addressLine1,
          line2: formData.addressLine2,
          city: formData.city,
          postCode: formData.postCode,
          country: formData.country
        },
        emergencyContact: {
          name: formData.emergencyName,
          relationship: formData.emergencyRelationship,
          phone: formData.emergencyPhone
        },
        // Ensure other fields are properly named
        otherInformation: formData.otherInfo
      };

      const result = await updateUserProfile(profileData);
      
      if (result.success) {
        // Show success message
        alert("Profile updated successfully!");
        // Navigate back to MyAccount page
        navigate("/myaccount");
      } else {
        alert(result.error || "Failed to save profile changes. Please try again.");
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert("Failed to save profile changes: " + (error.message || "Please try again."));
    }
  };

  const handleCancel = () => {
    // just go back without saving
    navigate("/myaccount/profiles");
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <h1 className="text-2xl font-semibold mb-2">My Profile</h1>
      <p className="text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:underline hover:text-green-600">
            Home
            
        </Link>{" "}
        /{" "}
        <Link to="/myaccount/profiles" className="hover:underline hover:text-green-600">
            My Settings
        </Link>{" "}
        
        / <span className="text-green-600">Edit</span>
        </p>
      {/* Card */}
      <div className="bg-white rounded border shadow p-6">
        <h2 className="text-lg font-medium mb-6">Edit My Profile</h2>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Personal Information Section */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
            
            {/* Username */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600">Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                readOnly
                className="mt-1 w-full border rounded bg-gray-100 px-3 py-2 text-gray-700"
              />
            </div>

            {/* First + Last Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <label className="block text-sm text-gray-600">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            {/* Email */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </div>

            {/* DOB + Gender */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <label className="block text-sm text-gray-600">Date of Birth</label>
                <SyncfusionDatePicker
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  placeholder="Select date of birth"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="mt-1 w-full border rounded px-3 py-2"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>

            {/* Mobile + Nationality */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <label className="block text-sm text-gray-600">Mobile</label>
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  placeholder="(201) 555-0123"
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Nationality</label>
                <input
                  type="text"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleChange}
                  placeholder="e.g., British, American, Polish"
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            {/* Preferred Language */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600">Preferred Language</label>
              <select
                name="language"
                value={formData.language}
                onChange={handleChange}
                className="mt-1 w-full border rounded px-3 py-2"
              >
                <option value="">Select an Option</option>
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
                <option value="Polish">Polish</option>
              </select>
            </div>
          </div>

          {/* Employment Information Section */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Employment Information</h3>
            
            {/* Company + Staff Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <label className="block text-sm text-gray-600">Company</label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Staff Type</label>
                <select
                  name="staffType"
                  value={formData.staffType}
                  onChange={handleChange}
                  className="mt-1 w-full border rounded px-3 py-2"
                >
                  <option value="">Select Staff Type</option>
                  <option value="Direct">Direct</option>
                  <option value="Contractor">Contractor</option>
                  <option value="Agency">Agency</option>
                  <option value="Team">Team</option>
                </select>
              </div>
            </div>

            {/* Job Roles + Job Level */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Job Roles</label>
                <SearchableDropdown
                  name="jobRole"
                  value={formData.jobTitle}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!formData.jobTitle.includes(value)) {
                      // Add new job title
                      setFormData(prev => ({
                        ...prev,
                        jobTitle: [...prev.jobTitle, value]
                      }));
                    }
                  }}
                  options={jobRoles}
                  placeholder="Type to search job roles or add new..."
                  onSearch={handleJobRoleSearch}
                  onAddNew={handleAddJobRole}
                  className="w-full mb-2"
                  isMultiSelect={true}
                />
                <p className="text-xs text-gray-500 mb-2">
                  You can type to search existing job roles or add a new one
                </p>
                {formData.jobTitle.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">Selected ({formData.jobTitle.length}):</div>
                    <div className="flex flex-wrap gap-1">
                      {formData.jobTitle.map((role) => (
                        <span
                          key={role}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
                        >
                          {role}
                          <button
                            type="button"
                            onClick={() => handleJobTitleChange(role)}
                            className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-emerald-400 hover:bg-emerald-200 hover:text-emerald-600 focus:outline-none"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-600">Job Level</label>
                <JobLevelDropdown
                  name="jobLevel"
                  value={formData.jobLevel}
                  onChange={handleChange}
                  placeholder="Type to search job levels or add new..."
                  className="mt-1 w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  You can type to search existing job levels or add a new one
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="mt-1 w-full border rounded px-3 py-2"
              >
                <option value="">Select Status</option>
                <option value="Onboarded">Onboarded</option>
                <option value="Onboarding">Onboarding</option>
                <option value="Dropped Out">Dropped Out</option>
                <option value="Left">Left</option>
              </select>
            </div>

            {/* POC */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600">Point of Contact (POC)</label>
              <input
                type="text"
                name="poc"
                value={formData.poc}
                onChange={handleChange}
                placeholder="Enter POC name"
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          {/* System IDs Section */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">System IDs</h3>
            
            {/* Circet IDs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <label className="block text-sm text-gray-600">Circet UIN</label>
                <input
                  type="text"
                  name="circetUIN"
                  value={formData.circetUIN}
                  onChange={handleChange}
                  placeholder="Enter Circet UIN"
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Circet SCID</label>
                <input
                  type="text"
                  name="circetSCID"
                  value={formData.circetSCID}
                  onChange={handleChange}
                  placeholder="Enter Circet SCID"
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            {/* Morrisons IDs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <label className="block text-sm text-gray-600">Morrisons ID Number</label>
                <input
                  type="text"
                  name="morrisonsIDNumber"
                  value={formData.morrisonsIDNumber}
                  onChange={handleChange}
                  placeholder="Enter Morrisons ID Number"
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Morrisons UIN</label>
                <input
                  type="text"
                  name="morrisonsUIN"
                  value={formData.morrisonsUIN}
                  onChange={handleChange}
                  placeholder="Enter Morrisons UIN"
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            {/* NOPS ID */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600">NOPS ID</label>
              <input
                type="text"
                name="nopsID"
                value={formData.nopsID}
                onChange={handleChange}
                placeholder="Enter NOPS ID"
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Address Section */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Address Information</h3>
            
            {/* Address Lines */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600">Address Line 1</label>
              <input
                type="text"
                name="addressLine1"
                value={formData.addressLine1}
                onChange={handleChange}
                placeholder="Enter street address"
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-600">Address Line 2</label>
              <input
                type="text"
                name="addressLine2"
                value={formData.addressLine2}
                onChange={handleChange}
                placeholder="Apartment, suite, etc. (optional)"
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </div>

            {/* City + Post Code */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <label className="block text-sm text-gray-600">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Enter city"
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Post Code</label>
                <input
                  type="text"
                  name="postCode"
                  value={formData.postCode}
                  onChange={handleChange}
                  placeholder="Enter post code"
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            {/* Country */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600">Country</label>
              <select
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="mt-1 w-full border rounded px-3 py-2"
              >
                <option value="">Poland</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="United States">United States</option>
                <option value="Germany">Germany</option>
                <option value="France">France</option>
                <option value="Spain">Spain</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Emergency Contact Section */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Emergency Contact</h3>
            
            {/* Emergency Name + Relationship */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <label className="block text-sm text-gray-600">Contact Name</label>
                <input
                  type="text"
                  name="emergencyName"
                  value={formData.emergencyName}
                  onChange={handleChange}
                  placeholder="Enter emergency contact name"
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Relationship</label>
                <select
                  name="emergencyRelationship"
                  value={formData.emergencyRelationship}
                  onChange={handleChange}
                  className="mt-1 w-full border rounded px-3 py-2"
                >
                  <option value="">Select Relationship</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Parent">Parent</option>
                  <option value="Child">Child</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Friend">Friend</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Emergency Phone */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600">Emergency Phone</label>
              <input
                type="tel"
                name="emergencyPhone"
                value={formData.emergencyPhone}
                onChange={handleChange}
                placeholder="Enter emergency contact phone"
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Additional Information Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
            
            {/* Bio */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600">Bio</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder="Enter a Bio (optional)"
                rows={3}
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </div>

            {/* Other Info */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600">Other Information</label>
              <textarea
                name="otherInfo"
                value={formData.otherInfo}
                onChange={handleChange}
                placeholder="Enter other details (optional)"
                rows={3}
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border rounded bg-gray-100 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
            >
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
