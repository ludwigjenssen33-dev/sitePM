export type TreeOperation = 'multiply' | 'sum' | 'subtract';
export type TreeComponent = { id: string; name: string; value: number };
export function treeResult(components: TreeComponent[], operation: TreeOperation): number {
  if (!components.length || components.some(c => !Number.isFinite(c.value) || Math.abs(c.value) > 1e12)) throw new Error('Укажите хотя бы один компонент с конечным значением не более 10¹² по модулю.');
  const result = operation === 'multiply' ? components.reduce((v, c) => v * c.value, 1) : operation === 'sum' ? components.reduce((v, c) => v + c.value, 0) : components.slice(1).reduce((v, c) => v - c.value, components[0].value);
  if (!Number.isFinite(result) || Math.abs(result) > 1e15) throw new Error('Результат слишком велик. Уменьшите значения компонентов.');
  return result;
}
export function retentionModel(initial: number, retention: number, periods = 6) {
  if (!Number.isSafeInteger(initial) || initial <= 0 || initial > 1e9 || !Number.isFinite(retention) || retention < 0 || retention > 1 || !Number.isInteger(periods) || periods < 1 || periods > 36) throw new Error('Проверьте размер когорты, вероятность удержания и число периодов.');
  return Array.from({ length: periods + 1 }, (_, month) => ({ month, label: month === 0 ? 'Старт' : `Месяц ${month}`, users: Math.round(initial * retention ** month), rate: 100 * retention ** month }));
}
export function unitEconomics(conversion: number, income: number, variableCost: number, visitors: number) {
  if (![conversion, income, variableCost, visitors].every(Number.isFinite) || conversion < 0 || conversion > 1 || income < 0 || variableCost < 0 || !Number.isSafeInteger(visitors) || visitors <= 0) throw new Error('Конверсия должна быть от 0 до 100%, доход и затраты — неотрицательными, аудитория — положительным целым числом.');
  const margin = income - variableCost;
  const expectedProfit = visitors * conversion * margin;
  if (!Number.isFinite(expectedProfit)) throw new Error('Результат слишком велик. Уменьшите аудиторию или денежные параметры.');
  return { margin, profitPerUser: conversion * margin, expectedOrders: visitors * conversion, expectedProfit };
}
export function normalCurve(center: number, se: number) {
  if (![center, se].every(Number.isFinite) || se <= 0) return [];
  return Array.from({ length: 81 }, (_, i) => { const x = center + (i / 10 - 4) * se; return { x: Number((x * 100).toFixed(4)), density: Math.exp(-.5 * ((x - center) / se) ** 2) / (100 * se * Math.sqrt(2 * Math.PI)) }; });
}
export function parseNumericInput(value: string) {
  if (!value.trim()) throw new Error('Заполните все числовые поля.');
  const result = Number(value.replace(',', '.'));
  if (!Number.isFinite(result)) throw new Error('Введите конечное число.');
  return result;
}
