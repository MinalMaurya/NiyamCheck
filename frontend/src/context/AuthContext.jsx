import React, { createContext, useContext, useState, useEffect } from 'react';

const ROLES = {
  OFFICER: 'OFFICER',
  CONSUMER: 'CONSUMER',
  VENDOR: 'VENDOR',
};

const DEFAULT_PROFILES = {
  OFFICER: {
    id: 'OFF-MH-4001',
    name: 'Inspector R. Sharma',
    role: 'OFFICER',
    designation: 'Senior Legal Metrology Inspector',
    badge: 'LM-OFF-MH-4001',
    jurisdiction: 'Mumbai Metrology Division, Maharashtra',
    department: 'Department of Consumer Affairs & Legal Metrology',
    email: 'r.sharma.lm@nic.in',
  },
  CONSUMER: {
    id: 'CONS-9021',
    name: 'Citizen Consumer',
    role: 'CONSUMER',
    designation: 'Consumer / Citizen User',
    badge: null,
    jurisdiction: 'All India',
    department: 'Consumer Grievance Awareness',
    email: 'consumer@nic.in',
  },
  VENDOR: {
    id: 'VEND-5510',
    name: 'Packer / Merchant Agent',
    role: 'VENDOR',
    designation: 'Manufacturer Compliance Manager',
    badge: 'MFR-IN-REG-2024',
    jurisdiction: 'Pre-packaged Commodity Production',
    department: 'Packaged Goods Quality Assurance',
    email: 'compliance@vendor.com',
  },
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [role, setRoleState] = useState(() => {
    try {
      return localStorage.getItem('niyamcheck_role') || ROLES.OFFICER;
    } catch {
      return ROLES.OFFICER;
    }
  });

  const [officerProfile, setOfficerProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('niyamcheck_officer_profile');
      return saved ? JSON.parse(saved) : DEFAULT_PROFILES.OFFICER;
    } catch {
      return DEFAULT_PROFILES.OFFICER;
    }
  });

  const setRole = (newRole) => {
    if (Object.values(ROLES).includes(newRole)) {
      setRoleState(newRole);
      try {
        localStorage.setItem('niyamcheck_role', newRole);
      } catch (e) {
        console.warn('Could not persist role in localStorage:', e);
      }
    }
  };

  const updateOfficerProfile = (updates) => {
    setOfficerProfile((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem('niyamcheck_officer_profile', JSON.stringify(next));
      } catch (e) {
        console.warn('Could not persist officer profile:', e);
      }
      return next;
    });
  };

  const currentUser = role === ROLES.OFFICER
    ? officerProfile
    : DEFAULT_PROFILES[role] || DEFAULT_PROFILES.CONSUMER;

  const isOfficer = role === ROLES.OFFICER;
  const isConsumer = role === ROLES.CONSUMER;
  const isVendor = role === ROLES.VENDOR;

  const value = {
    role,
    setRole,
    currentUser,
    officerProfile,
    updateOfficerProfile,
    isOfficer,
    isConsumer,
    isVendor,
    ROLES,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // Graceful fallback if rendered outside provider
    return {
      role: ROLES.OFFICER,
      setRole: () => {},
      currentUser: DEFAULT_PROFILES.OFFICER,
      officerProfile: DEFAULT_PROFILES.OFFICER,
      updateOfficerProfile: () => {},
      isOfficer: true,
      isConsumer: false,
      isVendor: false,
      ROLES,
    };
  }
  return context;
}
