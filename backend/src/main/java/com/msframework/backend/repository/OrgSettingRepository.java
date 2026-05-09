package com.msframework.backend.repository;

import com.msframework.backend.entity.OrgSetting;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrgSettingRepository extends JpaRepository<OrgSetting, String> {
}
