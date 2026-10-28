"""Valida budget mensal exclusivo, abrangendo todos os servicos e alertas."""
import json
import sys
from decimal import Decimal


def valid_budget(budget, number, amount, currency):
    scope = budget.get("budgetFilter", {})
    money = budget.get("amount", {}).get("specifiedAmount", {})
    actual = Decimal(str(money.get("units", 0))) + Decimal(str(money.get("nanos", 0))) / 10**9
    thresholds = {Decimal(str(t.get("thresholdPercent", 0))) for t in budget.get("thresholdRules", [])
                  if t.get("spendBasis", "CURRENT_SPEND") == "CURRENT_SPEND"}
    notifications = budget.get("allUpdatesRule", {})
    return (scope.get("projects") == ["projects/" + number]
            and scope.get("calendarPeriod") == "MONTH"
            and not any(scope.get(k) for k in ("services", "resourceAncestors", "subaccounts", "labels"))
            and 0 < actual <= Decimal(amount)
            and money.get("currencyCode") == currency
            and {Decimal("0.5"), Decimal("0.8"), Decimal("1")} <= thresholds
            and (not notifications.get("disableDefaultIamRecipients", False)
                 or notifications.get("monitoringNotificationChannels")))


if __name__ == "__main__":
    if not any(valid_budget(b, *sys.argv[1:4]) for b in json.load(sys.stdin)):
        sys.exit("BLOQUEADO: budget mensal exclusivo com valor/moeda e alertas 50/80/100 nao comprovado.")
    print("Budget mensal exclusivo e alertas verificados na API; isto nao comprova Spend Cap nem teto absoluto.")
