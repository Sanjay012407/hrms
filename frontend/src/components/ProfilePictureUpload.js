import React, { useState } from 'react';
import { CameraIcon, TrashIcon } from '@heroicons/react/24/outline';

const ProfilePictureUpload = ({ 
  profilePicture, 
  onUpload, 
  onDelete,
  firstName = '',
  lastName = '',
  uploading = false,
  size = 120
}) => {
  const [previewUrl, setPreviewUrl] = useState(profilePicture);
  const fileInputRef = React.useRef(null);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPEG, PNG, or GIF)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size should be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);

    if (onUpload) {
      await onUpload(file);
    }

    event.target.value = '';
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete your profile picture?')) {
      setPreviewUrl(null);
      if (onDelete) {
        await onDelete();
      }
    }
  };

  const getInitials = () => {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return `${first}${last}` || '?';
  };

  return (
    <div className="relative inline-block">
      <div 
        className="rounded-full overflow-hidden shadow-lg border-4 border-white relative"
        style={{ width: size, height: size }}
      >
        {uploading ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : previewUrl ? (
          <img
            src={previewUrl}
            alt={`${firstName} ${lastName}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white text-4xl font-semibold">
            {getInitials()}
          </div>
        )}
        
        {uploading && (
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
            <div className="text-white text-xs font-medium">Uploading...</div>
          </div>
        )}
      </div>

      {!uploading && (
        <>
          <button
            type="button"
            onClick={handleUploadClick}
            className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg transition-colors"
            title="Upload photo"
          >
            <CameraIcon className="h-5 w-5" />
          </button>

          {previewUrl && (
            <button
              type="button"
              onClick={handleDelete}
              className="absolute top-0 right-0 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 shadow-lg transition-colors"
              title="Delete photo"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/jpg"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};

export default ProfilePictureUpload;
