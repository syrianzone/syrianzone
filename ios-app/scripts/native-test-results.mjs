export function assertSelectedTestsPassed(selections, report) {
  if (!Array.isArray(selections) || !selections.length || !Array.isArray(report?.testNodes)) throw new Error('Native test results or selections are invalid.');
  const cases = [];
  const visit = node => {
    if (!node || typeof node !== 'object' || node.children != null && !Array.isArray(node.children)) throw new Error('Native test results are invalid.');
    if (node.nodeType === 'Test Case' && typeof node.nodeIdentifier === 'string') cases.push({ identifier: node.nodeIdentifier.replace(/\(\)$/, ''), result: node.result });
    node.children?.forEach(visit);
  };
  report.testNodes.forEach(visit);
  for (const selection of selections) {
    if (typeof selection !== 'string' || !/^[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+(?:\/[a-zA-Z0-9_]+)?$/.test(selection)) throw new Error('Native test selection is invalid.');
    const [, testClass, method] = selection.split('/');
    const matched = cases.filter(node => method ? node.identifier === `${testClass}/${method}` : node.identifier.startsWith(`${testClass}/`));
    if (!matched.length) throw new Error(`Native test selection did not execute: ${selection}.`);
    const failed = matched.find(node => node.result !== 'Passed');
    if (failed) throw new Error(`Native test did not pass: ${failed.identifier} (${failed.result ?? 'missing result'}).`);
  }
}
