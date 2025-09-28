// src/pages/Signup.js
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ErrorBoundary from "../components/ErrorBoundary";
import { EnvelopeIcon as MailIcon, LockClosedIcon, UserIcon } from '@heroicons/react/24/outline';

export default function Signup() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "admin", // Always admin for this signup page
    termsAccepted: false,
    requireEmailVerification: true,
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const navigate = useNavigate();
  const { signup, loading, error } = useAuth();

  // This signup page is admin-only
  useEffect(() => {
    // Ensure role is always admin for this page
    setFormData((prev) => ({ ...prev, role: "admin" }));
  }, []);

  // Fix loading issue
  useEffect(() => {
    let isMounted = true;

    const initializeComponent = () => {
      if (isMounted) {
        setIsLoading(false);
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready
    const timer = requestAnimationFrame(() => {
      initializeComponent();
    });

    return () => {
      isMounted = false;
      cancelAnimationFrame(timer);
    };
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.termsAccepted) {
      newErrors.termsAccepted = "You must accept the terms & conditions";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        termsAccepted: formData.termsAccepted,
        requireEmailVerification: formData.requireEmailVerification,
      };
      const result = await signup(payload);

      if (result.success) {
        alert(
          "Admin account created successfully! Please check your email to verify your account. Once verified, you'll be automatically redirected to the admin dashboard."
        );
        navigate("/login");
      } else {
        setErrors({ general: result.error || "Signup failed. Please try again." });
      }
    } catch (error) {
      setErrors({ general: "Signup failed. Please try again." });
    }
  };

  // Show loading spinner to prevent blank page
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100 flex items-center justify-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-2000"></div>
        </div>
        
        <div className="max-w-lg w-full space-y-8 relative z-10">
          {/* Header */}
          <div className="text-center animate-fade-in-up">
            <div className="mx-auto h-28 w-28 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center mb-4 shadow-lg border-4 border-white">
              <img
                src="/TSL.png"
                alt="TSL Logo"
                className="h-20 w-20 object-contain drop-shadow-sm"
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.nextElementSibling.style.display = "block";
                }}
              />
              <svg
                className="h-10 w-10 text-emerald-600 hidden"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Admin Account</h2>
            <p className="text-gray-600">Join the HRMS platform with admin privileges</p>
            <div className="mt-4 flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
              <p className="text-sm text-gray-500">Email verification required</p>
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
            </div>
          </div>

          <div className="mt-8 animate-fade-in-up animation-delay-200">
            {/* Signup Form */}
            <div className="bg-white/80 backdrop-blur-sm py-8 px-8 shadow-2xl rounded-2xl border border-white/50 hover:shadow-3xl transition-all duration-300">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {(errors.general || error) && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-400 p-4 rounded-lg shadow-sm animate-shake">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="h-4 w-4 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">{errors.general || error}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="firstName" className="block text-sm font-semibold text-gray-700 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <UserIcon className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                    </div>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={handleChange}
                      className={`block w-full pl-12 pr-4 py-3 border-2 ${
                        errors.firstName 
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                          : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-200'
                      } rounded-xl placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-200 ease-in-out text-gray-900 bg-gray-50 hover:bg-white`}
                      placeholder="First name"
                    />
                    {errors.firstName && (
                      <p className="mt-2 text-sm text-red-600 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {errors.firstName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="lastName" className="block text-sm font-semibold text-gray-700 mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <UserIcon className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                    </div>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={handleChange}
                      className={`block w-full pl-12 pr-4 py-3 border-2 ${
                        errors.lastName 
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                          : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-200'
                      } rounded-xl placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-200 ease-in-out text-gray-900 bg-gray-50 hover:bg-white`}
                      placeholder="Last name"
                    />
                    {errors.lastName && (
                      <p className="mt-2 text-sm text-red-600 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {errors.lastName}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MailIcon className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`block w-full pl-12 pr-4 py-3 border-2 ${
                      errors.email 
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                        : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-200'
                    } rounded-xl placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-200 ease-in-out text-gray-900 bg-gray-50 hover:bg-white`}
                    placeholder="Enter your email address"
                  />
                  {errors.email && (
                    <p className="mt-2 text-sm text-red-600 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`block w-full pl-12 pr-4 py-3 border-2 ${
                      errors.password 
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                        : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-200'
                    } rounded-xl placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-200 ease-in-out text-gray-900 bg-gray-50 hover:bg-white`}
                    placeholder="Create a secure password"
                  />
                  {errors.password && (
                    <p className="mt-2 text-sm text-red-600 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.password}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`block w-full pl-12 pr-4 py-3 border-2 ${
                      errors.confirmPassword 
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                        : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-200'
                    } rounded-xl placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-200 ease-in-out text-gray-900 bg-gray-50 hover:bg-white`}
                    placeholder="Confirm your password"
                  />
                  {errors.confirmPassword && (
                    <p className="mt-2 text-sm text-red-600 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>

              {/* Role Selection */}
              {/*<div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Signup as
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                      formData.role === "user"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                        : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="user"
                      checked={formData.role === "user"}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div className="flex w-full items-center justify-between">
                      <div className="text-sm">
                        <div className="font-medium">User</div>
                        <div className="text-gray-500">Access your profile & certificates</div>
                      </div>
                      {formData.role === "user" && (
                        <svg
                          className="h-5 w-5 text-emerald-600"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </label>
                  <label
                    className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                      formData.role === "admin"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                        : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      checked={formData.role === "admin"}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div className="flex w-full items-center justify-between">
                      <div className="text-sm">
                        <div className="font-medium">Admin</div>
                        <div className="text-gray-500">Full system management (requires approval)</div>
                      </div>
                      {formData.role === "admin" && (
                        <svg
                          className="h-5 w-5 text-emerald-600"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </label>
                </div>
              </div>*/}

              {/* Email verification option */}
              {/*<div className="flex items-center">
                <input
                  id="requireEmailVerification"
                  name="requireEmailVerification"
                  type="checkbox"
                  checked={formData.requireEmailVerification}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, requireEmailVerification: e.target.checked }))
                  }
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                />
                <label htmlFor="requireEmailVerification" className="ml-2 block text-sm text-gray-700">
                  Require email verification before login
                </label>
              </div>*/}

              {/* Terms & Conditions */}
              <div className="flex items-start space-x-3 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                <div className="flex items-center h-5">
                  <input
                    id="termsAccepted"
                    name="termsAccepted"
                    type="checkbox"
                    checked={formData.termsAccepted}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, termsAccepted: e.target.checked }))
                    }
                    className="h-5 w-5 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded transition-colors duration-200"
                  />
                </div>
                <div className="text-sm">
                  <label htmlFor="termsAccepted" className="text-gray-700 font-medium cursor-pointer">
                    I agree to the{" "}
                    <button 
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="text-emerald-600 hover:text-emerald-700 underline font-semibold transition-colors duration-200 bg-transparent border-none cursor-pointer"
                    >
                      Terms & Conditions
                    </button>
                    {" "}and{" "}
                    <button 
                      type="button"
                      onClick={() => setShowPrivacyModal(true)}
                      className="text-emerald-600 hover:text-emerald-700 underline font-semibold transition-colors duration-200 bg-transparent border-none cursor-pointer"
                    >
                      Privacy Policy
                    </button>
                  </label>
                  {errors.termsAccepted && (
                    <p className="mt-2 text-sm text-red-600 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.termsAccepted}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex justify-center py-4 px-6 border border-transparent rounded-xl text-base font-semibold text-white transition-all duration-200 ease-in-out transform ${
                    loading
                      ? 'bg-gray-400 cursor-not-allowed scale-95'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-4 focus:ring-emerald-200 hover:scale-105 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Creating account...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      Create Admin Account
                    </div>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white/80 text-gray-600 font-medium">Already have an account?</span>
                </div>
              </div>

              <div className="mt-6">
                <Link
                  to="/login"
                  className="w-full flex justify-center py-3 px-6 border-2 border-emerald-500 rounded-xl text-sm font-semibold text-emerald-600 bg-white/50 backdrop-blur-sm hover:bg-emerald-50 hover:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-200 transition-all duration-200 ease-in-out transform hover:scale-105 shadow-md hover:shadow-lg"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Sign in to existing account
                </Link>
              </div>
              
              <div className="mt-6 text-center space-y-3">
                <p className="text-xs text-gray-500 leading-relaxed">
                  By creating an account, you agree to our{' '}
                  <button 
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="text-emerald-600 hover:text-emerald-700 font-semibold underline bg-transparent border-none cursor-pointer transition-colors duration-200"
                  >
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button 
                    type="button"
                    onClick={() => setShowPrivacyModal(true)}
                    className="text-emerald-600 hover:text-emerald-700 font-semibold underline bg-transparent border-none cursor-pointer transition-colors duration-200"
                  >
                    Privacy Policy
                  </button>
                </p>
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                  <p className="text-xs text-gray-600 font-medium">Powered by Vitrux Shield</p>
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse animation-delay-1000"></div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* Terms and Conditions Modal */}
        {showTermsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Terms and Conditions</h3>
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                  <h4 className="mb-4 font-semibold text-gray-900">Terms & Conditions</h4>
                  <p className="mb-4">
                    Welcome to Vitrux Shield. By accessing and using this Application, you agree to comply with and be bound by these Terms & Conditions.
                  </p>
                  <h5 className="mb-3 font-semibold text-gray-900">1. Acceptance of Terms</h5>
                  <p className="mb-4">
                    By creating an admin account and using this HRMS system, you acknowledge that you have read, understood, and agree to be bound by these terms.
                  </p>
                  <h5 className="mb-3 font-semibold text-gray-900">2. Admin Responsibilities</h5>
                  <p className="mb-4">
                    As an administrator, you are responsible for maintaining the confidentiality of user data, ensuring proper access controls, and using the system in accordance with applicable laws and regulations.
                  </p>
                  <h5 className="mb-3 font-semibold text-gray-900">3. Data Protection</h5>
                  <p className="mb-4">
                    You agree to handle all personal and sensitive data in accordance with data protection laws and company policies. Unauthorized access or misuse of data is strictly prohibited.
                  </p>
                  <h5 className="mb-3 font-semibold text-gray-900">4. Account Security</h5>
                  <p className="mb-4">
                    You are responsible for maintaining the security of your admin account, including using strong passwords and keeping your login credentials confidential.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end p-6 border-t bg-gray-50">
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Privacy Policy Modal */}
        {showPrivacyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Privacy Policy</h3>
                <button
                  onClick={() => setShowPrivacyModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                  <h4 className="mb-4 font-semibold text-gray-900">Privacy Policy</h4>
                  <p className="mb-4">
                    This Privacy Policy explains how Vitrux Shield collects, uses, and protects personal data within the HRMS application.
                  </p>
                  <h5 className="mb-3 font-semibold text-gray-900">1. Information We Collect</h5>
                  <p className="mb-4">
                    We collect information necessary for HR management including employee personal details, professional information, certifications, and system usage data.
                  </p>
                  <h5 className="mb-3 font-semibold text-gray-900">2. How We Use Information</h5>
                  <p className="mb-4">
                    Information is used for HR management purposes, compliance tracking, certificate management, and system administration. We do not share personal data with unauthorized third parties.
                  </p>
                  <h5 className="mb-3 font-semibold text-gray-900">3. Data Security</h5>
                  <p className="mb-4">
                    We implement appropriate technical and organizational measures to protect personal data against unauthorized access, alteration, disclosure, or destruction.
                  </p>
                  <h5 className="mb-3 font-semibold text-gray-900">4. Data Retention</h5>
                  <p className="mb-4">
                    Personal data is retained only as long as necessary for the purposes outlined in this policy or as required by applicable laws and regulations.
                  </p>
                  <h5 className="mb-3 font-semibold text-gray-900">5. Your Rights</h5>
                  <p className="mb-4">
                    You have the right to access, correct, or request deletion of your personal data, subject to legal and contractual obligations.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end p-6 border-t bg-gray-50">
                <button
                  onClick={() => setShowPrivacyModal(false)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
