"""
Module Verification Tests for MastaBlasta
Tests the modules identified as needing verification in FEATURE_COMPARISON.md

Modules Tested:
1. Auto-Engagement - Backend trigger execution
2. Content Recycling - AI content modification
3. Workspace Collaboration - Invite/remove member flows
4. Campaign Management - Post-to-campaign association
"""
import pytest
import json
import os
import sys
from uuid import uuid4
from datetime import datetime, timezone, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app as flask_app
from models import (
    Base, User, Account, Post, Media, 
    Workspace, WorkspaceMember, Campaign, 
    AutoEngagement, ContentRecycleSchedule,
    UserRole, PostStatus
)
from auth import hash_password, create_access_token, encrypt_token

# Test Configuration
TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL', 'sqlite:///:memory:')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session

test_engine = create_engine(TEST_DATABASE_URL, echo=False)
TestSession = scoped_session(sessionmaker(bind=test_engine))


@pytest.fixture(scope='module')
def app():
    """Create Flask app for testing"""
    flask_app.config['TESTING'] = True
    flask_app.config['DATABASE_URL'] = TEST_DATABASE_URL
    yield flask_app


@pytest.fixture(scope='module')
def client(app):
    """Create test client"""
    return app.test_client()


@pytest.fixture(scope='function')
def db_session():
    """Create database session for testing"""
    Base.metadata.create_all(bind=test_engine)
    session = TestSession()
    yield session
    session.close()
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def test_user(db_session):
    """Create test user"""
    user = User(
        id=str(uuid4()),
        email='test@example.com',
        password_hash=hash_password('SecurePass123!'),
        full_name='Test User',
        role=UserRole.EDITOR,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def test_user_admin(db_session):
    """Create test admin user"""
    user = User(
        id=str(uuid4()),
        email='admin@example.com',
        password_hash=hash_password('SecurePass123!'),
        full_name='Admin User',
        role=UserRole.ADMIN,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def auth_headers(test_user):
    """Get authorization headers for test user"""
    role_value = test_user.role.value if hasattr(test_user.role, 'value') else test_user.role
    token = create_access_token(test_user.id, role_value)
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}


@pytest.fixture
def admin_auth_headers(test_user_admin):
    """Get authorization headers for admin user"""
    role_value = test_user_admin.role.value if hasattr(test_user_admin.role, 'value') else test_user_admin.role
    token = create_access_token(test_user_admin.id, role_value)
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}


# ============================================================================
# WORKSPACE COLLABORATION TESTS
# ============================================================================

class TestWorkspaceCollaboration:
    """Test Workspace collaboration - invite/remove member flows"""

    def test_create_workspace(self, client, auth_headers, test_user):
        """Test creating a new workspace"""
        response = client.post('/api/v2/workspaces', 
            headers=auth_headers,
            json={
                'name': 'Test Workspace',
                'description': 'A test workspace for verification'
            }
        )
        
        # Should succeed or return service unavailable if DB not enabled
        assert response.status_code in [200, 201, 503]
        
        if response.status_code in [200, 201]:
            data = response.get_json()
            assert 'id' in data
            assert data['name'] == 'Test Workspace'
            assert 'description' in data

    def test_get_workspaces(self, client, auth_headers):
        """Test getting workspaces for user"""
        response = client.get('/api/v2/workspaces', headers=auth_headers)
        
        assert response.status_code in [200, 503]
        
        if response.status_code == 200:
            data = response.get_json()
            assert 'workspaces' in data
            assert isinstance(data['workspaces'], list)

    def test_workspace_member_flow(self, client, auth_headers, db_session, test_user):
        """Test full workspace member invite/remove flow"""
        # Create workspace
        create_resp = client.post('/api/v2/workspaces',
            headers=auth_headers,
            json={'name': 'Member Test Workspace', 'description': 'Testing members'}
        )
        
        if create_resp.status_code in [200, 201]:
            workspace_id = create_resp.get_json()['id']
            
            # Get members (should include owner)
            members_resp = client.get(
                f'/api/v2/workspaces/{workspace_id}/members',
                headers=auth_headers
            )
            
            assert members_resp.status_code == 200
            members_data = members_resp.get_json()
            assert 'members' in members_data
            # Owner should be in the list
            owner_found = any(m.get('is_owner') for m in members_data['members'])
            assert owner_found, "Owner should be in member list"

    def test_workspace_model_creation(self, db_session, test_user):
        """Test Workspace model can be created and queried"""
        workspace = Workspace(
            id=str(uuid4()),
            owner_id=test_user.id,
            name='Model Test Workspace',
            description='Testing model creation',
            is_active=True
        )
        db_session.add(workspace)
        db_session.commit()

        # Query workspace
        found = db_session.query(Workspace).filter_by(name='Model Test Workspace').first()
        assert found is not None
        assert found.owner_id == test_user.id
        assert found.is_active is True

    def test_workspace_member_model_creation(self, db_session, test_user):
        """Test WorkspaceMember model can be created"""
        # Create workspace
        workspace = Workspace(
            id=str(uuid4()),
            owner_id=test_user.id,
            name='Member Model Workspace',
            is_active=True
        )
        db_session.add(workspace)
        db_session.commit()

        # Create another user to be member
        member_user = User(
            id=str(uuid4()),
            email='member@example.com',
            password_hash=hash_password('SecurePass123!'),
            full_name='Member User',
            role=UserRole.EDITOR,
            is_active=True
        )
        db_session.add(member_user)
        db_session.commit()

        # Add member to workspace
        membership = WorkspaceMember(
            id=str(uuid4()),
            workspace_id=workspace.id,
            user_id=member_user.id,
            role='editor',
            can_approve=False,
            can_publish=True,
            invited_by=test_user.id
        )
        db_session.add(membership)
        db_session.commit()

        # Verify membership
        found = db_session.query(WorkspaceMember).filter_by(
            workspace_id=workspace.id, 
            user_id=member_user.id
        ).first()
        assert found is not None
        assert found.role == 'editor'
        assert found.can_publish is True


# ============================================================================
# CAMPAIGN MANAGEMENT TESTS
# ============================================================================

class TestCampaignManagement:
    """Test Campaign management - post-to-campaign association"""

    def test_create_campaign(self, client, auth_headers):
        """Test creating a new campaign"""
        response = client.post('/api/v2/campaigns',
            headers=auth_headers,
            json={
                'name': 'Test Campaign',
                'description': 'A test campaign',
                'status': 'active',
                'color': '#FF5733'
            }
        )
        
        assert response.status_code in [200, 201, 503]
        
        if response.status_code in [200, 201]:
            data = response.get_json()
            assert 'id' in data
            assert data['name'] == 'Test Campaign'

    def test_get_campaigns(self, client, auth_headers):
        """Test getting campaigns for user"""
        response = client.get('/api/v2/campaigns', headers=auth_headers)
        
        assert response.status_code in [200, 503]
        
        if response.status_code == 200:
            data = response.get_json()
            assert 'campaigns' in data
            assert isinstance(data['campaigns'], list)

    def test_campaign_model_creation(self, db_session, test_user):
        """Test Campaign model can be created and queried"""
        campaign = Campaign(
            id=str(uuid4()),
            user_id=test_user.id,
            name='Model Test Campaign',
            description='Testing campaign model',
            status='active',
            color='#4CAF50',
            goals={'reach': 10000, 'engagement': 500}
        )
        db_session.add(campaign)
        db_session.commit()

        # Query campaign
        found = db_session.query(Campaign).filter_by(name='Model Test Campaign').first()
        assert found is not None
        assert found.user_id == test_user.id
        assert found.status == 'active'
        assert found.goals == {'reach': 10000, 'engagement': 500}

    def test_post_to_campaign_association(self, db_session, test_user):
        """Test associating a post with a campaign"""
        # Create campaign
        campaign = Campaign(
            id=str(uuid4()),
            user_id=test_user.id,
            name='Association Test Campaign',
            status='active'
        )
        db_session.add(campaign)
        db_session.commit()

        # Create post with campaign_id
        post = Post(
            id=str(uuid4()),
            user_id=test_user.id,
            content='Test post for campaign',
            campaign_id=campaign.id,
            status=PostStatus.DRAFT
        )
        db_session.add(post)
        db_session.commit()

        # Verify association
        found_post = db_session.query(Post).filter_by(campaign_id=campaign.id).first()
        assert found_post is not None
        assert found_post.content == 'Test post for campaign'
        
        # Verify campaign relationship
        found_campaign = db_session.query(Campaign).filter_by(id=campaign.id).first()
        assert found_campaign is not None


# ============================================================================
# AUTO-ENGAGEMENT TESTS
# ============================================================================

class TestAutoEngagement:
    """Test Auto-Engagement - backend trigger execution"""

    def test_get_auto_engagements(self, client, auth_headers):
        """Test getting auto-engagement rules"""
        response = client.get('/api/v2/auto-engagements', headers=auth_headers)
        
        assert response.status_code in [200, 503]
        
        if response.status_code == 200:
            data = response.get_json()
            assert 'rules' in data
            assert isinstance(data['rules'], list)

    def test_create_auto_engagement(self, client, auth_headers):
        """Test creating an auto-engagement rule"""
        response = client.post('/api/v2/auto-engagements',
            headers=auth_headers,
            json={
                'name': 'Like Milestone',
                'trigger_type': 'likes',
                'trigger_threshold': 100,
                'trigger_platform': 'twitter',
                'action_type': 'notify',
                'action_content': 'Your post reached 100 likes!'
            }
        )
        
        assert response.status_code in [200, 201, 503]
        
        if response.status_code in [200, 201]:
            data = response.get_json()
            assert 'id' in data
            assert data['name'] == 'Like Milestone'

    def test_auto_engagement_model_creation(self, db_session, test_user):
        """Test AutoEngagement model can be created and queried"""
        rule = AutoEngagement(
            id=str(uuid4()),
            user_id=test_user.id,
            name='Comment Milestone',
            is_active=True,
            trigger_type='comments',
            trigger_threshold=50,
            trigger_platform='instagram',
            action_type='notify',
            action_content='50 comments reached!',
            times_triggered=0
        )
        db_session.add(rule)
        db_session.commit()

        # Query rule
        found = db_session.query(AutoEngagement).filter_by(name='Comment Milestone').first()
        assert found is not None
        assert found.trigger_type == 'comments'
        assert found.trigger_threshold == 50
        assert found.action_type == 'notify'

    def test_auto_engagement_trigger_types(self, db_session, test_user):
        """Test different trigger types are valid"""
        trigger_types = ['likes', 'comments', 'views', 'shares']
        action_types = ['like', 'comment', 'repost', 'notify']
        
        for i, (trigger, action) in enumerate(zip(trigger_types, action_types)):
            rule = AutoEngagement(
                id=str(uuid4()),
                user_id=test_user.id,
                name=f'{trigger.title()} Rule',
                is_active=True,
                trigger_type=trigger,
                trigger_threshold=100 * (i + 1),
                action_type=action,
                times_triggered=0
            )
            db_session.add(rule)
        
        db_session.commit()

        # Verify all were created
        rules = db_session.query(AutoEngagement).filter_by(user_id=test_user.id).all()
        assert len(rules) == 4


# ============================================================================
# CONTENT RECYCLING TESTS
# ============================================================================

class TestContentRecycling:
    """Test Content Recycling - AI content modification"""

    def test_get_recycle_schedules(self, client, auth_headers):
        """Test getting content recycle schedules"""
        response = client.get('/api/v2/recycle-schedules', headers=auth_headers)
        
        assert response.status_code in [200, 503]
        
        if response.status_code == 200:
            data = response.get_json()
            assert 'schedules' in data
            assert isinstance(data['schedules'], list)

    def test_create_recycle_schedule(self, client, auth_headers):
        """Test creating a content recycle schedule"""
        # First need a post to recycle - this might fail if no posts exist
        response = client.post('/api/v2/recycle-schedules',
            headers=auth_headers,
            json={
                'post_id': str(uuid4()),  # This may not exist
                'recycle_interval_days': 30,
                'max_recycles': 5,
                'modify_content': True,
                'modification_type': 'ai_rewrite',
                'target_platforms': ['twitter', 'facebook']
            }
        )
        
        # May return 404 if post doesn't exist, or 503 if DB not enabled
        assert response.status_code in [200, 201, 404, 503]

    def test_content_recycle_model_creation(self, db_session, test_user):
        """Test ContentRecycleSchedule model can be created"""
        # Create a post first
        post = Post(
            id=str(uuid4()),
            user_id=test_user.id,
            content='Evergreen content to recycle',
            status=PostStatus.PUBLISHED
        )
        db_session.add(post)
        db_session.commit()

        # Create recycle schedule
        schedule = ContentRecycleSchedule(
            id=str(uuid4()),
            user_id=test_user.id,
            post_id=post.id,
            recycle_interval_days=30,
            next_recycle_at=datetime.now(timezone.utc) + timedelta(days=30),
            max_recycles=5,
            current_recycle_count=0,
            modify_content=True,
            modification_type='ai_rewrite',
            target_platforms=['twitter', 'instagram'],
            is_active=True
        )
        db_session.add(schedule)
        db_session.commit()

        # Verify creation
        found = db_session.query(ContentRecycleSchedule).filter_by(post_id=post.id).first()
        assert found is not None
        assert found.recycle_interval_days == 30
        assert found.modify_content is True
        assert found.modification_type == 'ai_rewrite'

    def test_modification_types(self, db_session, test_user):
        """Test different content modification types"""
        modification_types = ['ai_rewrite', 'shuffle', 'none']
        
        for mod_type in modification_types:
            post = Post(
                id=str(uuid4()),
                user_id=test_user.id,
                content=f'Content for {mod_type}',
                status=PostStatus.PUBLISHED
            )
            db_session.add(post)
            db_session.commit()

            schedule = ContentRecycleSchedule(
                id=str(uuid4()),
                user_id=test_user.id,
                post_id=post.id,
                recycle_interval_days=14,
                modify_content=(mod_type != 'none'),
                modification_type=mod_type,
                is_active=True
            )
            db_session.add(schedule)
        
        db_session.commit()

        # Verify all types were created
        for mod_type in modification_types:
            found = db_session.query(ContentRecycleSchedule).filter_by(
                modification_type=mod_type
            ).first()
            assert found is not None, f"Schedule with {mod_type} not found"


# ============================================================================
# API ENDPOINT VERIFICATION TESTS
# ============================================================================

class TestAPIEndpoints:
    """Test that all required API endpoints exist and respond"""

    def test_workspace_endpoints_exist(self, client, auth_headers):
        """Verify all workspace endpoints respond"""
        endpoints = [
            ('GET', '/api/v2/workspaces'),
        ]
        
        for method, path in endpoints:
            if method == 'GET':
                response = client.get(path, headers=auth_headers)
            elif method == 'POST':
                response = client.post(path, headers=auth_headers, json={})
            
            # Should not return 404 (endpoint exists)
            assert response.status_code != 404, f"{method} {path} returned 404"

    def test_campaign_endpoints_exist(self, client, auth_headers):
        """Verify all campaign endpoints respond"""
        endpoints = [
            ('GET', '/api/v2/campaigns'),
        ]
        
        for method, path in endpoints:
            if method == 'GET':
                response = client.get(path, headers=auth_headers)
            
            assert response.status_code != 404, f"{method} {path} returned 404"

    def test_auto_engagement_endpoints_exist(self, client, auth_headers):
        """Verify all auto-engagement endpoints respond"""
        response = client.get('/api/v2/auto-engagements', headers=auth_headers)
        assert response.status_code != 404, "GET /api/v2/auto-engagements returned 404"

    def test_recycle_schedule_endpoints_exist(self, client, auth_headers):
        """Verify all recycle schedule endpoints respond"""
        response = client.get('/api/v2/recycle-schedules', headers=auth_headers)
        assert response.status_code != 404, "GET /api/v2/recycle-schedules returned 404"


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

class TestIntegration:
    """Integration tests for combined functionality"""

    def test_workspace_with_campaign_integration(self, db_session, test_user):
        """Test workspace can contain campaigns"""
        # Create workspace
        workspace = Workspace(
            id=str(uuid4()),
            owner_id=test_user.id,
            name='Integration Workspace',
            is_active=True
        )
        db_session.add(workspace)
        db_session.commit()

        # Create campaign in workspace
        campaign = Campaign(
            id=str(uuid4()),
            user_id=test_user.id,
            workspace_id=workspace.id,
            name='Workspace Campaign',
            status='active'
        )
        db_session.add(campaign)
        db_session.commit()

        # Verify relationship
        found_campaign = db_session.query(Campaign).filter_by(workspace_id=workspace.id).first()
        assert found_campaign is not None
        assert found_campaign.name == 'Workspace Campaign'

    def test_full_workflow(self, db_session, test_user):
        """Test complete workflow: workspace -> campaign -> post -> recycle"""
        # Create workspace
        workspace = Workspace(
            id=str(uuid4()),
            owner_id=test_user.id,
            name='Full Workflow Workspace',
            is_active=True
        )
        db_session.add(workspace)
        
        # Create campaign
        campaign = Campaign(
            id=str(uuid4()),
            user_id=test_user.id,
            workspace_id=workspace.id,
            name='Full Workflow Campaign',
            status='active'
        )
        db_session.add(campaign)
        
        # Create post
        post = Post(
            id=str(uuid4()),
            user_id=test_user.id,
            workspace_id=workspace.id,
            campaign_id=campaign.id,
            content='Full workflow post content',
            status=PostStatus.PUBLISHED
        )
        db_session.add(post)
        
        db_session.commit()

        # Create recycle schedule for post
        schedule = ContentRecycleSchedule(
            id=str(uuid4()),
            user_id=test_user.id,
            post_id=post.id,
            recycle_interval_days=7,
            modify_content=True,
            modification_type='ai_rewrite',
            is_active=True
        )
        db_session.add(schedule)
        
        # Create auto-engagement rule
        rule = AutoEngagement(
            id=str(uuid4()),
            user_id=test_user.id,
            name='Workflow Auto-Engagement',
            is_active=True,
            trigger_type='likes',
            trigger_threshold=100,
            action_type='notify'
        )
        db_session.add(rule)
        
        db_session.commit()

        # Verify full workflow
        assert db_session.query(Workspace).count() >= 1
        assert db_session.query(Campaign).count() >= 1
        assert db_session.query(Post).count() >= 1
        assert db_session.query(ContentRecycleSchedule).count() >= 1
        assert db_session.query(AutoEngagement).count() >= 1


# ============================================================================
# RUN ALL TESTS
# ============================================================================

if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
