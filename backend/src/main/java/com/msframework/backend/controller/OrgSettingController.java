package com.msframework.backend.controller;

import com.msframework.backend.entity.OrgSetting;
import com.msframework.backend.repository.OrgSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class OrgSettingController {

    private final OrgSettingRepository orgSettingRepository;

    @GetMapping("/{key}")
    public ResponseEntity<OrgSetting> get(@PathVariable String key) {
        return orgSettingRepository.findById(key)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{key}")
    public ResponseEntity<OrgSetting> put(@PathVariable String key, @RequestBody Map<String, String> body) {
        String value = body.getOrDefault("value", "");
        OrgSetting setting = orgSettingRepository.findById(key)
                .orElse(OrgSetting.builder().key(key).build());
        setting.setValue(value);
        setting.setUpdatedAt(LocalDateTime.now());
        return ResponseEntity.ok(orgSettingRepository.save(setting));
    }
}
