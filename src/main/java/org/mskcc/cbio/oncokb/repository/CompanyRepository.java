package org.mskcc.cbio.oncokb.repository;

import java.util.Optional;

import org.springframework.cache.annotation.Cacheable;

import org.mskcc.cbio.oncokb.domain.Company;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;

/**
 * Spring Data  repository for the Company entity.
 */
@SuppressWarnings("unused")
@Repository
public interface CompanyRepository extends JpaRepository<Company, Long> {

    @Cacheable(cacheResolver = "companyCacheResolver")
    Optional<Company> findById(Long id);

    @Cacheable(cacheResolver = "companyCacheResolver")
    Optional<Company> findOneByNameIgnoreCase(String name);
}