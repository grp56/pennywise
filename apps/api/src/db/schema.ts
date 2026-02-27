import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const transactionTypeEnum = pgEnum("transaction_type", ["income", "expense"]);

export const transactionSourceEnum = pgEnum("transaction_source", ["manual", "mock_import"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    usernameUnique: uniqueIndex("users_username_unique").on(table.username),
  }),
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    type: transactionTypeEnum("type").notNull(),
    isSystem: boolean("is_system").default(true).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("categories_slug_unique").on(table.slug),
  }),
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: transactionTypeEnum("type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").default("HKD").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    transactionDate: date("transaction_date", { mode: "string" }).notNull(),
    remarks: text("remarks"),
    source: transactionSourceEnum("source").default("manual").notNull(),
    externalRef: text("external_ref"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    amountPositive: check(
      "transactions_amount_cents_positive_check",
      sql`${table.amountCents} > 0`,
    ),
    currencyFixed: check("transactions_currency_hkd_check", sql`${table.currency} = 'HKD'`),
    remarksLength: check(
      "transactions_remarks_length_check",
      sql`${table.remarks} is null or char_length(${table.remarks}) <= 280`,
    ),
    orderedIndex: index("transactions_user_transaction_date_created_at_idx").on(
      table.userId,
      sql`${table.transactionDate} desc`,
      sql`${table.createdAt} desc`,
    ),
    categoryIndex: index("transactions_user_category_idx").on(table.userId, table.categoryId),
    typeIndex: index("transactions_user_type_idx").on(table.userId, table.type),
    externalRefUnique: uniqueIndex("transactions_user_external_ref_unique")
      .on(table.userId, table.externalRef)
      .where(sql`${table.externalRef} is not null`),
  }),
);

export const session = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", {
      precision: 6,
      withTimezone: false,
      mode: "date",
    }).notNull(),
  },
  (table) => ({
    expireIndex: index("IDX_session_expire").on(table.expire),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type CategoryRow = typeof categories.$inferSelect;
export type NewCategoryRow = typeof categories.$inferInsert;
export type TransactionRow = typeof transactions.$inferSelect;
export type NewTransactionRow = typeof transactions.$inferInsert;
export type SessionRow = typeof session.$inferSelect;
