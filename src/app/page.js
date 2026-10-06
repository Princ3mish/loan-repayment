"use client";

import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { apiFetch } from "@/lib/apiClient";
import SignIn from "@/components/SignIn";
import LoanPicker from "@/components/LoanPicker";
import LoanSummary from "@/components/LoanSummary";
import LoanSchedule from "@/components/LoanSchedule";
import PaymentForm from "@/components/PaymentForm";
import PaymentHistory from "@/components/PaymentHistory";

export default function Home() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [loans, setLoans] = useState([]);
  const [selectedLoanId, setSelectedLoanId] = useState(null);
  const [loanDetail, setLoanDetail] = useState(null);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  const loadLoanDetail = useCallback(async (id) => {
    if (!id) {
      setLoanDetail(null);
      return;
    }
    setLoadingDetail(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/loans/${id}`);
      setLoanDetail(res.data);
    } catch (err) {
      setError(err.message || "Failed to load loan details");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const loadLoans = useCallback(async () => {
    setLoadingLoans(true);
    setError(null);
    try {
      const res = await apiFetch("/api/loans");
      const list = res.data?.loans || [];
      setLoans(list);

      let targetId = null;
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const urlId = params.get("loan");
        if (urlId && list.some((l) => l.id === urlId)) {
          targetId = urlId;
        }
      }

      if (!targetId && list.length > 0) {
        targetId = list[0].id;
      }

      setSelectedLoanId(targetId);
      if (targetId) {
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("loan", targetId);
          window.history.replaceState(null, "", url.toString());
        }
        await loadLoanDetail(targetId);
      }
    } catch (err) {
      setError(err.message || "Failed to load loans");
    } finally {
      setLoadingLoans(false);
    }
  }, [loadLoanDetail]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        loadLoans();
      } else {
        setLoans([]);
        setSelectedLoanId(null);
        setLoanDetail(null);
        setError(null);
      }
    });
    return () => unsubscribe();
  }, [loadLoans]);

  function handleSelectLoan(id) {
    setSelectedLoanId(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (id) {
        url.searchParams.set("loan", id);
      } else {
        url.searchParams.delete("loan");
      }
      window.history.replaceState(null, "", url.toString());
    }
    loadLoanDetail(id);
  }

  function handlePaymentSuccess(data) {
    if (data?.loan) {
      setLoanDetail(data.loan);
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  }

  if (authLoading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading application...</p>
      </div>
    );
  }

  if (!user) {
    return <SignIn />;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-logo-small">Vitto</span>
          <h1 className="header-title">Loan Repayment Service</h1>
        </div>

        <div className="header-user">
          <span className="user-email">{user.email || user.uid}</span>
          <button onClick={handleSignOut} className="btn btn-outline btn-sm">
            Sign out
          </button>
        </div>
      </header>

      <main className="main-content">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="toolbar">
          <LoanPicker
            loans={loans}
            selectedId={selectedLoanId}
            onSelect={handleSelectLoan}
            loading={loadingLoans}
          />
        </div>

        {loadingDetail ? (
          <div className="card-loading">
            <div className="spinner"></div>
            <p>Loading loan details...</p>
          </div>
        ) : loanDetail ? (
          <div className="loan-dashboard">
            <LoanSummary
              loan={loanDetail.loan}
              position={loanDetail.position}
            />

            <PaymentForm
              loanId={selectedLoanId}
              position={loanDetail.position}
              onPaid={handlePaymentSuccess}
            />

            <LoanSchedule
              schedule={loanDetail.schedule}
              nextDueDate={loanDetail.position?.nextDueDate}
            />

            <PaymentHistory payments={loanDetail.payments} />
          </div>
        ) : !loadingLoans && loans.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>No Loans Available</h3>
            <p>You currently do not have any active loans on record.</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
