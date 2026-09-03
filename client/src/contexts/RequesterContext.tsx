import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface Requester {
  id: number;
  name: string;
  email: string;
}

interface RequesterContextType {
  selectedRequester: Requester | null;
  setSelectedRequester: (requester: Requester | null) => void;
}

const RequesterContext = createContext<RequesterContextType | undefined>(undefined);

export function RequesterProvider({ children }: { children: ReactNode }) {
  const [selectedRequester, setSelectedRequester] = useState<Requester | null>(() => {
    const saved = localStorage.getItem("toktickit_dev_requester_id");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (selectedRequester) {
      localStorage.setItem("toktickit_dev_requester_id", JSON.stringify(selectedRequester));
    } else {
      localStorage.removeItem("toktickit_dev_requester_id");
    }
  }, [selectedRequester]);

  return (
    <RequesterContext.Provider value={{ selectedRequester, setSelectedRequester }}>
      {children}
    </RequesterContext.Provider>
  );
}

export function useRequester() {
  const context = useContext(RequesterContext);
  if (!context) {
    throw new Error("useRequester must be used within a RequesterProvider");
  }
  return context;
}
