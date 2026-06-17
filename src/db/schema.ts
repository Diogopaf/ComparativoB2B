import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Etapa 1: Modelagem do Banco de Dados

// Tenant (Cliente do SaaS)
export const tenants = sqliteTable('tenants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  // Campos adicionais do tenant se necessário
});

// Product
export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  isCompetitor: integer('is_competitor', { mode: 'boolean' }).notNull().default(false),
  features: text('features').notNull(), // Armazenado como string JSON para características dinâmicas
});

// Comparison
// Armazena as vantagens e desvantagens de um produto do cliente em relação a um concorrente
export const comparisons = sqliteTable('comparisons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  clientProductId: integer('client_product_id').notNull().references(() => products.id),
  competitorProductId: integer('competitor_product_id').notNull().references(() => products.id),
  advantages: text('advantages'), // JSON ou texto com as vantagens
  disadvantages: text('disadvantages'), // JSON ou texto com as desvantagens
});

export type Tenant = typeof tenants.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Comparison = typeof comparisons.$inferSelect;
