<?php
class TestRealDatabase extends PHPUnit\Framework\TestCase {
    
    /**
     * Test querying the real WordPress database
     */
    public function test_query_wordpress_users() {
        global $wpdb;
        
        // Test that wpdb is available
        $this->assertNotNull($wpdb, 'WordPress $wpdb object should be available');
        
        // Query users from the real database
        $users = $wpdb->get_results("SELECT ID, user_login FROM {$wpdb->users} LIMIT 5");
        
        // Assert that we got some results (assuming your site has users)
        $this->assertIsArray($users, 'Users query should return an array');
        $this->assertNotEmpty($users, 'Should have at least one user in the database');
        
        // Test that the first user has expected properties
        if (!empty($users)) {
            $first_user = $users[0];
            $this->assertObjectHasProperty('ID', $first_user);
            $this->assertObjectHasProperty('user_login', $first_user);
            $this->assertIsNumeric($first_user->ID);
        }
    }
    
    /**
     * Test querying WordPress posts
     */
    public function test_query_wordpress_posts() {
        global $wpdb;
        
        // Query posts from the real database
        $posts = $wpdb->get_results("SELECT ID, post_title, post_status FROM {$wpdb->posts} WHERE post_type = 'post' LIMIT 3");
        
        $this->assertIsArray($posts, 'Posts query should return an array');
        
        // If there are posts, test their structure
        if (!empty($posts)) {
            $first_post = $posts[0];
            $this->assertObjectHasProperty('ID', $first_post);
            $this->assertObjectHasProperty('post_title', $first_post);
            $this->assertObjectHasProperty('post_status', $first_post);
        }
    }
    
    /**
     * Test WordPress database connection
     */
    public function test_database_connection() {
        global $wpdb;
        
        // Test database connection by running a simple query
        $result = $wpdb->get_var("SELECT 1");
        $this->assertEquals(1, $result, 'Database connection should work');
        
        // Test that we can get the database name
        $db_name = $wpdb->get_var("SELECT DATABASE()");
        $this->assertNotEmpty($db_name, 'Should be able to get database name');
    }
    
    /**
     * Test WordPress options table
     */
    public function test_wordpress_options() {
        global $wpdb;
        
        // Get some basic WordPress options
        $site_url = get_option('siteurl');
        //echo 'siteurl : ' . $site_url.'\n';
        $blog_name = get_option('blogname');
        
        $this->assertNotEmpty($site_url, 'Site URL should not be empty');
        $this->assertNotEmpty($blog_name, 'Blog name should not be empty');
        
        // Test direct database query for options
        $options_count = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->options}");
        $this->assertGreaterThan(0, $options_count, 'Options table should have entries');
    }
    
    /**
     * Test custom query with prepared statements
     */
    public function test_prepared_statement() {
        global $wpdb;
        
        // Use prepared statement to safely query the database
        $user_count = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->users} WHERE user_status = %d",
                0
            )
        );
        
        $this->assertIsNumeric($user_count, 'User count should be numeric');
        $this->assertGreaterThanOrEqual(0, $user_count, 'User count should be >= 0');
    }
}
