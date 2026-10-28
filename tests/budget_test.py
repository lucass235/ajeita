import copy
import importlib.util
import pathlib
import unittest

source = pathlib.Path(__file__).parents[1] / 'cloudrun' / 'verificar-orcamento.py'
spec = importlib.util.spec_from_file_location('budget', source)
budget = importlib.util.module_from_spec(spec)
spec.loader.exec_module(budget)


class BudgetTest(unittest.TestCase):
    def setUp(self):
        self.value = {'budgetFilter': {'projects': ['projects/123'], 'calendarPeriod': 'MONTH'},
                      'amount': {'specifiedAmount': {'units': '5', 'currencyCode': 'USD'}},
                      'thresholdRules': [{'thresholdPercent': n} for n in (.5, .8, 1)]}

    def test_valid_budget(self):
        self.assertTrue(budget.valid_budget(self.value, '123', '5', 'USD'))

    def test_rejects_wrong_scope_money_or_notifications(self):
        for section, key, value in [('budgetFilter', 'projects', ['projects/999']),
                                    ('budgetFilter', 'projects', ['projects/123', 'projects/999']),
                                    ('budgetFilter', 'calendarPeriod', 'YEAR'),
                                    ('budgetFilter', 'services', ['services/run']),
                                    ('budgetFilter', 'labels', {'app': ['ajeita']}),
                                    ('allUpdatesRule', 'disableDefaultIamRecipients', True)]:
            candidate = copy.deepcopy(self.value)
            candidate.setdefault(section, {})[key] = value
            with self.subTest(key=key, value=value):
                self.assertFalse(budget.valid_budget(candidate, '123', '5', 'USD'))
        self.assertFalse(budget.valid_budget(self.value, '123', '4', 'USD'))
        self.assertFalse(budget.valid_budget(self.value, '123', '5', 'BRL'))
        self.value['thresholdRules'].pop()
        self.assertFalse(budget.valid_budget(self.value, '123', '5', 'USD'))


if __name__ == '__main__':
    unittest.main()
