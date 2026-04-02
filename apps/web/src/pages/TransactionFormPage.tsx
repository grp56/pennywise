import type {
  Category,
  CreateTransactionInput,
  Transaction,
  TransactionType,
} from "@pennywise/contracts";
import { createTransactionInputSchema, dateOnlySchema } from "@pennywise/contracts";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth";
import { apiClient, getValidationFieldErrors, isApiClientError } from "../lib/api";
import {
  formatAmountInputFromCents,
  getTodayDateValue,
  parseAmountInputToCents,
} from "../lib/format";

interface TransactionFormPageProps {
  mode: "create" | "edit";
}

interface TransactionFormValues {
  amount: string;
  categoryId: string;
  remarks: string;
  transactionDate: string;
  type: TransactionType;
}

type TransactionFormErrors = Record<
  "amount" | "categoryId" | "remarks" | "transactionDate" | "type",
  string | undefined
>;

function getDefaultFormValues(): TransactionFormValues {
  return {
    type: "expense",
    amount: "",
    categoryId: "",
    transactionDate: getTodayDateValue(),
    remarks: "",
  };
}

function createFormValuesFromTransaction(transaction: Transaction): TransactionFormValues {
  return {
    type: transaction.type,
    amount: formatAmountInputFromCents(transaction.amountCents),
    categoryId: transaction.categoryId,
    transactionDate: transaction.transactionDate,
    remarks: transaction.remarks ?? "",
  };
}

function validateTransactionForm(
  values: TransactionFormValues,
  categories: Category[],
): { errors: TransactionFormErrors; payload: CreateTransactionInput | null } {
  const errors: TransactionFormErrors = {
    type: undefined,
    amount: undefined,
    categoryId: undefined,
    transactionDate: undefined,
    remarks: undefined,
  };
  const amountCents = parseAmountInputToCents(values.amount);

  if (amountCents === null) {
    errors.amount = "Enter a valid HKD amount with up to 2 decimal places.";
  }

  const category = categories.find((entry) => entry.id === values.categoryId);

  if (!category) {
    errors.categoryId = "Choose a category.";
  } else if (category.type !== values.type) {
    errors.categoryId = "Choose a category that matches the selected type.";
  }

  if (!dateOnlySchema.safeParse(values.transactionDate).success) {
    errors.transactionDate = "Enter a valid transaction date.";
  }

  if (values.remarks.length > 280) {
    errors.remarks = "Remarks must be 280 characters or fewer.";
  }

  if (amountCents === null || errors.categoryId || errors.transactionDate || errors.remarks) {
    return {
      errors,
      payload: null,
    };
  }

  const parsed = createTransactionInputSchema.safeParse({
    type: values.type,
    amountCents,
    categoryId: values.categoryId,
    transactionDate: values.transactionDate,
    remarks: values.remarks.trim() === "" ? undefined : values.remarks.trim(),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      errors: {
        type: fieldErrors.type?.[0],
        amount: fieldErrors.amountCents?.[0],
        categoryId: fieldErrors.categoryId?.[0],
        transactionDate: fieldErrors.transactionDate?.[0],
        remarks: fieldErrors.remarks?.[0],
      },
      payload: null,
    };
  }

  return {
    errors,
    payload: parsed.data,
  };
}

export function TransactionFormPage({ mode }: TransactionFormPageProps) {
  const navigate = useNavigate();
  const { transactionId } = useParams();
  const { markSessionExpired } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [values, setValues] = useState<TransactionFormValues>(getDefaultFormValues);
  const [fieldErrors, setFieldErrors] = useState<TransactionFormErrors>({
    type: undefined,
    amount: undefined,
    categoryId: undefined,
    transactionDate: undefined,
    remarks: undefined,
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadPageData() {
      setLoading(true);
      setLoadError(null);

      try {
        const loadedCategories = await apiClient.getCategories();

        if (ignore) {
          return;
        }

        setCategories(loadedCategories);

        if (mode === "edit") {
          if (!transactionId) {
            setLoadError("Transaction id is missing.");
            setLoading(false);
            return;
          }

          const transaction = await apiClient.getTransaction(transactionId);

          if (ignore) {
            return;
          }

          setValues(createFormValuesFromTransaction(transaction));
        } else {
          setValues((current) => ({
            ...current,
            transactionDate: current.transactionDate || getTodayDateValue(),
          }));
        }
      } catch (error) {
        if (ignore) {
          return;
        }

        if (isApiClientError(error) && error.status === 401) {
          markSessionExpired();
          return;
        }

        setLoadError(
          isApiClientError(error)
            ? (error.responseBody?.message ?? "Transaction form could not be loaded.")
            : "Transaction form could not be loaded.",
        );
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadPageData();

    return () => {
      ignore = true;
    };
  }, [markSessionExpired, mode, transactionId]);

  useEffect(() => {
    if (values.categoryId === "") {
      return;
    }

    const category = categories.find((entry) => entry.id === values.categoryId);

    if (category && category.type !== values.type) {
      setValues((current) => ({
        ...current,
        categoryId: "",
      }));
    }
  }, [categories, values.categoryId, values.type]);

  const availableCategories = useMemo(
    () => categories.filter((category) => category.type === values.type),
    [categories, values.type],
  );
  const clientValidation = useMemo(
    () => validateTransactionForm(values, categories),
    [categories, values],
  );

  function updateField<K extends keyof TransactionFormValues>(
    key: K,
    value: TransactionFormValues[K],
  ) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
    setFieldErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
    setSubmitError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors(clientValidation.errors);
    setSubmitError(null);

    if (!clientValidation.payload) {
      return;
    }

    setSubmitting(true);

    try {
      if (mode === "edit") {
        if (!transactionId) {
          throw new Error("Transaction id is missing.");
        }

        await apiClient.updateTransaction(transactionId, clientValidation.payload);
      } else {
        await apiClient.createTransaction(clientValidation.payload);
      }

      navigate("/transactions");
    } catch (error) {
      if (isApiClientError(error)) {
        if (error.status === 401) {
          markSessionExpired();
          return;
        }

        const validationErrors = getValidationFieldErrors(error);

        if (validationErrors) {
          setFieldErrors({
            type: validationErrors.type?.[0],
            amount: validationErrors.amountCents?.[0],
            categoryId: validationErrors.categoryId?.[0],
            transactionDate: validationErrors.transactionDate?.[0],
            remarks: validationErrors.remarks?.[0],
          });
        }

        setSubmitError(error.responseBody?.message ?? "Transaction could not be saved.");
      } else {
        console.error(error);
        setSubmitError("Transaction could not be saved.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="glass-panel empty-state">
        <h2 className="panel-title">Loading transaction form</h2>
        <p className="muted-text">Retrieving categories and existing values.</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="glass-panel empty-state" role="alert" aria-live="assertive">
        <h2 className="panel-title">Form unavailable</h2>
        <p className="muted-text">{loadError}</p>
        <Link className="button-secondary" to="/transactions">
          Back to history
        </Link>
      </section>
    );
  }

  return (
    <div className="content-grid">
      <section className="page-header">
        <div>
          <p className="section-eyebrow">
            {mode === "edit" ? "Edit Transaction" : "New Transaction"}
          </p>
          <h2 className="panel-title panel-title--hero">
            {mode === "edit" ? "Adjust an existing record" : "Record a new ledger entry"}
          </h2>
          <p className="muted-text">
            Amounts are entered in HKD and converted to the contract’s `amountCents` field on
            submit.
          </p>
        </div>

        <Link className="button-secondary" to="/transactions">
          Back to history
        </Link>
      </section>

      <section className="glass-panel form-panel">
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="field-row">
            <label className="field" htmlFor="transaction-form-type">
              <span className="field__label">Type</span>
              <select
                id="transaction-form-type"
                className="field__control"
                value={values.type}
                aria-invalid={fieldErrors.type ? "true" : "false"}
                aria-describedby={fieldErrors.type ? "transaction-form-type-error" : undefined}
                onChange={(event) => updateField("type", event.target.value as TransactionType)}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              {fieldErrors.type ? (
                <span
                  id="transaction-form-type-error"
                  className="field__error"
                  role="alert"
                  aria-live="polite"
                >
                  {fieldErrors.type}
                </span>
              ) : null}
            </label>

            <label className="field" htmlFor="transaction-form-amount">
              <span className="field__label">Amount (HKD)</span>
              <input
                id="transaction-form-amount"
                className="field__control"
                inputMode="decimal"
                placeholder="0.00"
                value={values.amount}
                aria-invalid={fieldErrors.amount ? "true" : "false"}
                aria-describedby={fieldErrors.amount ? "transaction-form-amount-error" : undefined}
                onChange={(event) => updateField("amount", event.target.value)}
              />
              {fieldErrors.amount ? (
                <span
                  id="transaction-form-amount-error"
                  className="field__error"
                  role="alert"
                  aria-live="polite"
                >
                  {fieldErrors.amount}
                </span>
              ) : null}
            </label>
          </div>

          <div className="field-row">
            <label className="field" htmlFor="transaction-form-category">
              <span className="field__label">Category</span>
              <select
                id="transaction-form-category"
                className="field__control"
                value={values.categoryId}
                aria-invalid={fieldErrors.categoryId ? "true" : "false"}
                aria-describedby={
                  fieldErrors.categoryId ? "transaction-form-category-error" : undefined
                }
                onChange={(event) => updateField("categoryId", event.target.value)}
              >
                <option value="">Choose a category</option>
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {fieldErrors.categoryId ? (
                <span
                  id="transaction-form-category-error"
                  className="field__error"
                  role="alert"
                  aria-live="polite"
                >
                  {fieldErrors.categoryId}
                </span>
              ) : null}
            </label>

            <label className="field" htmlFor="transaction-form-date">
              <span className="field__label">Transaction date</span>
              <input
                id="transaction-form-date"
                className="field__control"
                type="date"
                value={values.transactionDate}
                aria-invalid={fieldErrors.transactionDate ? "true" : "false"}
                aria-describedby={
                  fieldErrors.transactionDate ? "transaction-form-date-error" : undefined
                }
                onChange={(event) => updateField("transactionDate", event.target.value)}
              />
              {fieldErrors.transactionDate ? (
                <span
                  id="transaction-form-date-error"
                  className="field__error"
                  role="alert"
                  aria-live="polite"
                >
                  {fieldErrors.transactionDate}
                </span>
              ) : null}
            </label>
          </div>

          <label className="field" htmlFor="transaction-form-remarks">
            <span className="field__label">Remarks</span>
            <textarea
              id="transaction-form-remarks"
              className="field__control field__control--textarea"
              maxLength={280}
              rows={5}
              placeholder="Optional note about this entry"
              value={values.remarks}
              aria-invalid={fieldErrors.remarks ? "true" : "false"}
              aria-describedby={fieldErrors.remarks ? "transaction-form-remarks-error" : undefined}
              onChange={(event) => updateField("remarks", event.target.value)}
            />
            <div className="field__footer">
              <span>
                {fieldErrors.remarks ? (
                  <span
                    id="transaction-form-remarks-error"
                    className="field__error"
                    role="alert"
                    aria-live="polite"
                  >
                    {fieldErrors.remarks}
                  </span>
                ) : null}
              </span>
              <span className="muted-text">{values.remarks.length}/280</span>
            </div>
          </label>

          {submitError ? (
            <p className="form-error-banner" role="alert" aria-live="assertive">
              {submitError}
            </p>
          ) : null}

          <div className="form-actions">
            <Link className="button-secondary" to="/transactions">
              Cancel
            </Link>
            <button
              className="button-primary"
              type="submit"
              disabled={!clientValidation.payload || submitting}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {mode === "edit" ? "save" : "add_circle"}
              </span>
              <span>
                {submitting
                  ? "Saving..."
                  : mode === "edit"
                    ? "Save Transaction"
                    : "Create Transaction"}
              </span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
