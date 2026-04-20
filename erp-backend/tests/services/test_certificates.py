from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.core.exceptions import BusinessError
from app.services.certificates import CertificateService


@pytest.mark.asyncio
async def test_calculate_validity_status_uses_30_day_window(db_session):
    service = CertificateService(db_session)
    today = date.today()

    assert (
        service._calculate_validity_status(today + timedelta(days=31)).value
        == "有效"
    )
    assert (
        service._calculate_validity_status(today + timedelta(days=30)).value
        == "即将过期"
    )
    assert service._calculate_validity_status(today - timedelta(days=1)).value == "已过期"


@pytest.mark.asyncio
async def test_validate_validity_dates_rejects_start_not_before_end(db_session):
    service = CertificateService(db_session)
    today = date.today()

    with pytest.raises(BusinessError, match="有效期起始日期必须早于结束日期"):
        service._validate_validity_dates(today, today)
